# Terminal

A dual-shell command-line terminal emulator supporting both cmd.exe and bash shells with piping, redirection, variable expansion, tab completion, and a comprehensive set of built-in commands -- the power-user gateway to the »SynthelicZ« virtual file system.

## Product Requirements

### Purpose
Terminal gives advanced users and developers direct command-line access to the »SynthelicZ« virtual file system and system internals. It emulates both Windows cmd.exe and Unix bash shells, enabling file management, text processing, scripting, and system inspection through familiar command-line interfaces. It serves as the primary tool for power users who prefer typing commands over clicking through graphical interfaces.

### Key Capabilities
- Dual-shell environment with seamless switching between cmd.exe and bash modes
- Comprehensive file system commands (dir/ls, cd, mkdir, cp/copy, mv/move, rm/del, cat/type, tree)
- Text processing utilities in bash mode (grep, sed, sort, uniq, tr, cut, rev, wc, head, tail)
- Piping, output redirection, and command chaining (|, >, >>, &&, ||)
- Environment variable management with expansion syntax for both shells
- Command history navigation and tab completion for files, directories, and commands
- Batch file execution with conditional logic and loops
- Customizable console appearance with color commands and title changes

### Design Reference
Modeled after the Windows Command Prompt (cmd.exe) and Unix bash terminal, providing the familiar dual-personality approach seen in tools like Windows Terminal and Git Bash -- one window, two shell paradigms, unified file system access.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Shell Basics
- [x] As a user, I can type commands and see their output
- [x] As a user, I can switch between cmd.exe and bash shells
- [x] As a user, I can see the appropriate prompt for the active shell
- [x] As a user, I can clear the terminal screen
- [x] As a user, I can scroll through output history
- [ ] As a user, I can open multiple terminal tabs or split panes
- [ ] As a user, I can copy and paste text in the terminal

### Command History
- [x] As a user, I can navigate previous commands with the Up arrow key
- [x] As a user, I can navigate forward through history with the Down arrow key
- [ ] As a user, I can search command history with Ctrl+R (reverse search)
- [ ] As a user, I can persist command history across sessions

### Tab Completion
- [x] As a user, I can auto-complete file and directory names by pressing Tab
- [x] As a user, I can auto-complete commands by pressing Tab
- [ ] As a user, I can see a list of possible completions when there are multiple matches
- [ ] As a user, I can cycle through completions with repeated Tab presses

### File System Commands (CMD)
- [x] As a user, I can list directory contents with dir
- [x] As a user, I can change directories with cd
- [x] As a user, I can create directories with md/mkdir
- [x] As a user, I can remove directories with rd/rmdir
- [x] As a user, I can copy files with copy
- [x] As a user, I can move or rename files with move/ren
- [x] As a user, I can delete files with del/erase
- [x] As a user, I can display file contents with type
- [x] As a user, I can display a directory tree with tree

### File System Commands (Bash)
- [x] As a user, I can list directory contents with ls
- [x] As a user, I can change directories with cd and pwd
- [x] As a user, I can create directories with mkdir
- [x] As a user, I can remove files and directories with rm
- [x] As a user, I can copy files with cp
- [x] As a user, I can move files with mv
- [x] As a user, I can display file contents with cat
- [x] As a user, I can create files with touch

### Text Processing (Bash)
- [x] As a user, I can search file contents with grep
- [x] As a user, I can transform text with sed
- [x] As a user, I can sort lines with sort
- [x] As a user, I can filter unique lines with uniq
- [x] As a user, I can translate or delete characters with tr
- [x] As a user, I can extract columns with cut
- [x] As a user, I can reverse lines with rev
- [x] As a user, I can count lines, words, and characters with wc
- [x] As a user, I can view the beginning or end of files with head and tail

### Piping and Redirection
- [x] As a user, I can pipe the output of one command into another
- [x] As a user, I can redirect output to a file with > and >>
- [x] As a user, I can chain commands with && (and) and || (or)
- [ ] As a user, I can use input redirection with <
- [ ] As a user, I can use here-documents for multi-line input

### Variables and Environment
- [x] As a user, I can set and use environment variables in cmd (%VAR%)
- [x] As a user, I can set and use environment variables in bash ($VAR)
- [x] As a user, I can view all environment variables with set or env
- [x] As a user, I can export and unset variables in bash
- [x] As a user, I can use bash variable expansion with \${var:-default} syntax
- [ ] As a user, I can define and use aliases persistently

### System Information
- [x] As a user, I can see the OS version with ver or uname
- [x] As a user, I can see system information with systeminfo
- [x] As a user, I can see network configuration with ipconfig or hostname
- [x] As a user, I can see running processes with tasklist or ps
- [x] As a user, I can see the current date and time

### Scripting
- [x] As a user, I can execute batch files (.bat/.cmd)
- [x] As a user, I can use conditional logic with if statements
- [x] As a user, I can use loops with for
- [ ] As a user, I can execute bash scripts (.sh)
- [ ] As a user, I can define and call shell functions

### Console Appearance
- [x] As a user, I can change console colors with the color command
- [x] As a user, I can change the window title with the title command
- [ ] As a user, I can change the terminal font and font size
- [ ] As a user, I can choose from preset color schemes (Solarized, Monokai, etc.)
- [ ] As a user, I can set the terminal opacity/transparency
