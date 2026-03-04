;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  const TEMPLATES = [
    {
      id: 'professional',
      name: 'Professional',
      description: 'Classic single-column resume for experienced professionals',
      builtin: true,
      previewLayout: 'single-column',
      sections: [
        { id: 'personalInfo', label: 'Personal Information', required: true, type: 'personal-info' },
        { id: 'summary', label: 'Professional Summary', required: false, type: 'textarea' },
        { id: 'experience', label: 'Work Experience', required: false, type: 'experience-list' },
        { id: 'education', label: 'Education', required: false, type: 'education-list' },
        { id: 'skills', label: 'Skills', required: false, type: 'skills-grouped' },
        { id: 'certifications', label: 'Certifications', required: false, type: 'certifications-list' },
        { id: 'languages', label: 'Languages', required: false, type: 'languages-list' },
        { id: 'references', label: 'References', required: false, type: 'references-list' }
      ]
    },
    {
      id: 'technical',
      name: 'Technical',
      description: 'Skills-first layout with sidebar for tech professionals',
      builtin: true,
      previewLayout: 'sidebar-left',
      sections: [
        { id: 'personalInfo', label: 'Personal Information', required: true, type: 'personal-info' },
        { id: 'summary', label: 'Summary', required: false, type: 'textarea' },
        { id: 'skills', label: 'Technical Skills', required: false, type: 'skills-grouped' },
        { id: 'experience', label: 'Experience', required: false, type: 'experience-list' },
        { id: 'projects', label: 'Projects', required: false, type: 'projects-list' },
        { id: 'education', label: 'Education', required: false, type: 'education-list' },
        { id: 'certifications', label: 'Certifications', required: false, type: 'certifications-list' }
      ]
    },
    {
      id: 'academic',
      name: 'Academic CV',
      description: 'Dense serif layout for academic and research positions',
      builtin: true,
      previewLayout: 'dense-serif',
      sections: [
        { id: 'personalInfo', label: 'Personal Information', required: true, type: 'personal-info' },
        { id: 'researchInterests', label: 'Research Interests', required: false, type: 'textarea' },
        { id: 'education', label: 'Education', required: false, type: 'education-list' },
        { id: 'publications', label: 'Publications', required: false, type: 'list' },
        { id: 'experience', label: 'Professional Experience', required: false, type: 'experience-list' },
        { id: 'teaching', label: 'Teaching Experience', required: false, type: 'list' },
        { id: 'awards', label: 'Awards & Honors', required: false, type: 'list' },
        { id: 'skills', label: 'Skills', required: false, type: 'skills-grouped' }
      ]
    },
    {
      id: 'creative',
      name: 'Creative',
      description: 'Modern accent-bar design for creative roles',
      builtin: true,
      previewLayout: 'accent-bar',
      sections: [
        { id: 'personalInfo', label: 'Personal Information', required: true, type: 'personal-info' },
        { id: 'objective', label: 'Objective', required: false, type: 'textarea' },
        { id: 'projects', label: 'Portfolio / Projects', required: false, type: 'projects-list' },
        { id: 'experience', label: 'Experience', required: false, type: 'experience-list' },
        { id: 'skills', label: 'Skills', required: false, type: 'tags' },
        { id: 'education', label: 'Education', required: false, type: 'education-list' },
        { id: 'awards', label: 'Awards', required: false, type: 'list' }
      ]
    },
    {
      id: 'minimal',
      name: 'Minimal',
      description: 'Clean, tight layout with minimal decoration',
      builtin: true,
      previewLayout: 'clean-tight',
      sections: [
        { id: 'personalInfo', label: 'Personal Information', required: true, type: 'personal-info' },
        { id: 'summary', label: 'Summary', required: false, type: 'textarea' },
        { id: 'experience', label: 'Experience', required: false, type: 'experience-list' },
        { id: 'education', label: 'Education', required: false, type: 'education-list' },
        { id: 'skills', label: 'Skills', required: false, type: 'skills-grouped' }
      ]
    },
    {
      id: 'entry-level',
      name: 'Entry-Level',
      description: 'Education-first layout for recent graduates',
      builtin: true,
      previewLayout: 'single-column',
      sections: [
        { id: 'personalInfo', label: 'Personal Information', required: true, type: 'personal-info' },
        { id: 'objective', label: 'Career Objective', required: false, type: 'textarea' },
        { id: 'education', label: 'Education', required: false, type: 'education-list' },
        { id: 'projects', label: 'Projects', required: false, type: 'projects-list' },
        { id: 'skills', label: 'Skills', required: false, type: 'skills-grouped' },
        { id: 'experience', label: 'Experience', required: false, type: 'experience-list' },
        { id: 'volunteer', label: 'Volunteer Work', required: false, type: 'list' },
        { id: 'activities', label: 'Activities & Interests', required: false, type: 'list' }
      ]
    }
  ];

  SZ.ResumeTemplates = TEMPLATES;
})();
