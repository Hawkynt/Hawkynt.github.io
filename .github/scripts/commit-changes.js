#!/usr/bin/env node
// Commits the working-tree changes below the given paths to the current
// branch through GitHub's GraphQL API (createCommitOnBranch). GitHub signs
// commits made this way, so they show as verified, which a plain `git push`
// from the runner cannot do.
//
//   node .github/scripts/commit-changes.js '<message>' <path>...
//
// Needs GITHUB_TOKEN with contents: write. The commit is only made if the
// branch still points at EXPECTED_HEAD (default GITHUB_SHA).
// Exit codes: 0 committed or nothing to commit, 2 the branch moved on,
// 1 any other failure.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');

const [message, ...paths] = process.argv.slice(2);
if (!message || !paths.length) {
  console.error('usage: commit-changes.js <message> <path>...');
  process.exit(1);
}

const status = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...paths]).toString();
const additions = [], deletions = [];
for (const entry of status.split('\0').filter(Boolean)) {
  const code = entry.slice(0, 2), path = entry.slice(3);
  if (code.includes('D'))
    deletions.push({ path });
  else
    additions.push({ path, contents: fs.readFileSync(path).toString('base64') });
}
if (!additions.length && !deletions.length) {
  console.log('Nothing to commit.');
  process.exit(0);
}

const query = `mutation ($input: CreateCommitOnBranchInput!) {
  createCommitOnBranch(input: $input) { commit { oid url } }
}`;
const [headline, ...body] = message.split('\n');
const input = {
  branch: { repositoryNameWithOwner: process.env.GITHUB_REPOSITORY, branchName: process.env.GITHUB_REF_NAME },
  expectedHeadOid: process.env.EXPECTED_HEAD || process.env.GITHUB_SHA,
  message: { headline, body: body.join('\n').trim() || undefined },
  fileChanges: { additions, deletions },
};

(async () => {
  const res = await fetch(`${process.env.GITHUB_API_URL || 'https://api.github.com'}/graphql`, {
    method: 'POST',
    headers: { authorization: `bearer ${process.env.GITHUB_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables: { input } }),
  });
  const json = await res.json().catch(() => ({}));
  const commit = json.data && json.data.createCommitOnBranch && json.data.createCommitOnBranch.commit;
  if (commit) {
    console.log(`Committed ${additions.length + deletions.length} file(s) as ${commit.oid}: ${commit.url}`);
    process.exit(0);
  }
  const errors = (json.errors || []).map(e => e.message).join('; ') || `HTTP ${res.status}`;
  console.error(errors);
  process.exit(/expected branch to point/i.test(errors) ? 2 : 1);
})();
