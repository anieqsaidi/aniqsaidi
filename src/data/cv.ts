export const profile = {
  name: 'Aniq Saidi',
  role: 'Software Engineer',
  location: 'Selangor, Malaysia',
  email: 'aniqsaidi.official@gmail.com',
  linkedin: 'https://www.linkedin.com/in/aniqsaidi/',
  summary:
    'I build systems, optimize SQL, improve UIs, and occasionally lose four hours to a missing comma.',
  summaryDetail:
    'Across healthcare, cloud, data, and AI, I turn complex workflows into reliable, user-friendly software.',
  summaryNote: 'Currently brewing software for public healthcare.',
  summarySignoff: 'Always learning. Still debugging.',
  // availability: "Available after one month's notice.",
  languages: ['Malay - Native', 'English - Full professional proficiency'],
} as const;

export const experience = [
  {
    role: 'Software Engineer',
    company: 'Rakan KKM Sdn. Bhd.',
    location: 'Taman Tun Dr. Ismail, Kuala Lumpur',
    period: 'May 2026 - Present',
    start: '2026-05',
    summary: 'Building web and mobile patient and workforce-management products for public healthcare operations.',
    highlights: [
      'Develop patient-management workflows across web, Android, and iOS for healthcare operations.',
      'Maintain healthcare workforce and recruitment systems, resolving production issues and improving day-to-day reliability.',
      'Build and support employee-management and corporate web platforms across PHP, JavaScript, SQL, and Linux environments.',
    ],
    skills: ['PHP', 'JavaScript', 'SQL', 'HTML', 'CSS', 'Bootstrap', 'AI Integration', 'WebNative', 'Android', 'iOS', 'Linux'],
  },
  {
    role: 'Senior Systems Engineer',
    company: 'Fujitsu Systems Global Solutions Management Sdn. Bhd.',
    location: 'Jalan Pantai Baharu, Kuala Lumpur',
    period: 'Sep 2022 - Apr 2026',
    start: '2022-09',
    summary: 'Led cloud analytics and BI work across AWS, ETL, Qlik Sense, and Tableau, delivering cost and employee insights.',
    highlights: [
      'Optimized analytical SQL workloads in AWS Redshift for enterprise reporting.',
      'Built and migrated dashboards from Qlik Sense to Tableau while preserving reporting continuity.',
      'Led ETL and visualization-framework migration work across Redshift, Glue, S3, and Lake Formation.',
      'Delivered cost-management and employee-analytics views that strengthened operational visibility.',
      'Received a Certificate of Excellence and Best Performer Award for FY2023 contributions.',
    ],
    skills: ['SQL', 'AWS Redshift', 'AWS Glue', 'Lake Formation', 'S3', 'Qlik Sense', 'Tableau', 'Python', 'Azure DevOps', 'Agile'],
  },
  {
    role: 'Systems Engineer',
    company: 'Fujitsu Systems Global Solutions Management Sdn. Bhd.',
    location: 'Jalan Pantai Baharu, Kuala Lumpur',
    period: 'Jul 2021 - Aug 2022',
    start: '2021-07',
    summary: 'Built project and internal tools while onboarding and mentoring new engineers across development and delivery workflows.',
    highlights: [
      'Conducted technical onboarding and hands-on training for new joiners.',
      'Mentored trainees in development, testing, and documentation workflows.',
      'Supported a centralized POS system for a Japan-based project using C#.',
      'Developed sprint-management and project-tracking systems with Angular, Spring Boot, and VBA.',
      'Applied Agile and Scrum practices across internal development initiatives.',
    ],
    skills: ['C#', 'VBA', 'HTML', 'CSS', 'JavaScript', 'Java', 'Spring Boot', 'Angular', 'AWS EC2', 'Agile'],
  },
  {
    role: 'IT Business Analyst (Platform Developer)',
    company: 'Daikin Malaysia Sdn. Bhd.',
    location: 'Sungai Buloh, Selangor',
    period: 'Sep 2020 - Jun 2021',
    start: '2020-09',
    summary: 'Automated internal workflows and supported IoT mobile delivery, service reporting, testing, and QA across teams.',
    highlights: [
      'Developed workflow systems to streamline internal departmental operations.',
      'Led the Capital Expenditure Request process for an IoT mobile-application project.',
      'Collaborated with Daikin and Acson teams to improve service-reporting workflows.',
      'Performed testing and QA for mobile applications and service-reporting systems.',
    ],
    skills: ['Webparts360', 'Python', 'Workflow Automation', 'Mobile App Testing', 'IoT Development'],
  },
] as const;

export const skillGroups = [
  ['Frontend, Web & Mobile', 'HTML, CSS, JavaScript, Bootstrap, Angular, Android, iOS, WebNative'],
  ['Backend & Programming', 'PHP, Java, Spring Boot, Python, C#, VBA, SQL'],
  ['Cloud, Data & Analytics', 'AWS Redshift, Glue, Lake Formation, S3, EC2, Qlik Sense, Tableau, Power BI, ETL, BI and data visualization'],
  ['DevOps & Platforms', 'Azure DevOps, Linux, Workflow Automation, Webparts360, Microsoft Power Apps'],
  ['Methods & Practices', 'Agile/Scrum, AI Integration, IoT, System Testing and QA, Healthcare Systems'],
] as const;

export const education = [
  {
    qualification: 'Bachelor of Computer Science (Software Engineering) with Honors',
    institution: 'Universiti Malaysia Pahang Al-Sultan Abdullah (UMPSA)',
    period: 'GRADUATED // 2020',
  },
] as const;

export const undergraduateThesis = {
  title: 'Naturel Kiss Online Shopping (NKOS)',
  label: 'FINAL YEAR PROJECT // 2019',
  summary: 'Designed and developed an Android e-commerce prototype using Java and Rapid Application Development, then validated its core purchasing flows through UAT.',
  technologies: ['JAVA', 'ANDROID STUDIO', 'RAD', 'UAT'],
  repositoryUrl: 'https://umpir.ump.edu.my/id/eprint/26655/',
  pdfUrl: 'https://umpir.ump.edu.my/id/eprint/26655/1/Naturel%20kiss%20online%20shopping%20%28NKOS%29.pdf',
  catalogueUrl: 'https://neuseal.mod.gov.my/neuseal/Record/ump-26655',
} as const;

export const certifications = [
  { title: 'AWS: Storage and Data Management', issuer: 'LinkedIn', date: 'May 2023', datetime: '2023-05' },
  { title: 'Qlik Sense Essential Training', issuer: 'LinkedIn', date: 'May 2023', datetime: '2023-05' },
  { title: 'Python Essential Training', issuer: 'LinkedIn', date: 'May 2023', datetime: '2023-05' },
  { title: 'Professional Scrum Master I', issuer: 'Scrum.org', date: 'Oct 2023', datetime: '2023-10' },
  { title: 'Power BI Essential Training', issuer: 'LinkedIn', date: 'Jun 2024', datetime: '2024-06' },
  { title: 'Azure Administration Essential Training', issuer: 'LinkedIn', date: 'Jun 2024', datetime: '2024-06' },
  { title: 'Tableau 2024.1: Essential Training', issuer: 'LinkedIn', date: 'Jun 2024', datetime: '2024-06' },
  { title: 'AWS Knowledge: Cloud Essentials', issuer: 'Amazon Web Services', date: 'Nov 2024', datetime: '2024-11' },
  { title: 'AWS Partner: Security Essentials (Technical)', issuer: 'Amazon Web Services', date: 'Nov 2024', datetime: '2024-11' },
  { title: 'AWS Partner: Security Best Practices (Technical)', issuer: 'Amazon Web Services', date: 'Nov 2024', datetime: '2024-11' },
] as const;

export const awards = [
  ['Fujitsu Certificate of Excellence', 'Outstanding performance and contributions in FY2023.'],
  ['Fujitsu Best Performer Award', 'Outstanding project contributions in Q2 FY2023.'],
  ['Fujitsu Best Project Award', 'Best Project in Q2 FY2023.'],
  ['Fujitsu Best Project Award', 'Best Project in Q2 FY2022.'],
  ['Fujitsu STARS Silver Award', 'Commitment and contributions to the organization.'],
  ['CITREx 2020 Silver Medal', 'Naturel Kiss Online Shopping mobile application system.'],
  ['Deputy Vice-Chancellor Special Award', 'Outstanding co-curricular and student-leadership achievements at UMPSA.'],
  ["Dean's List Award", 'Academic excellence in Semester 2, Session 2016/2017.'],
  ['iCE-CInno 2016 Bronze Medal', 'E-Aduan hygiene complaint system for UMPSA residential-college cafeterias.'],
] as const;

export const leadership = [
  ['President, Student Representative Council - UMPSA', 'Represented and advocated for student welfare and campus initiatives, 2017-2018.'],
  ['Third Vice-President, National Student Consultative Council', "Supported student welfare initiatives across Malaysia's East Coast region, 2017-2018."],
  ['Head of Volunteers - MASUM Sports Carnival', 'Led volunteer activities for the 2019 university sports carnival.'],
  ['Director - National Kokuria Carnival', 'Directed the national program in 2018.'],
  ['Director - SRC International Community Service Program', 'Led the 2018 international program in Indonesia.'],
  ['Safety & Health Coordinator - UMPSA', 'Coordinated university safety and health initiatives from 2017 to 2019.'],
  ['Vice-Secretary - Student Representative Committee', 'Served the student body at Kelantan Matriculation College in 2014/2015.'],
  ['Vice-President - Indoor Game Club', 'Helped lead student club activities at SMK Bandar Baru Sungai Buloh in 2013.'],
] as const;
