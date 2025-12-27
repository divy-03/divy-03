# Dynamic Readme n8n Workflow

This workflow is designed to dynamically update my README file with various statistics and information, including GitHub stats, age calculation, my typing speed and resume details.

- Scheduled to trigger every midnight
  - Github Stats
    - Fetches all my repositories stats
    - Count forks, watchers, issues
  - Get existing SVG file
    - decode base64 to UTF-8 text
  - Get monkeytype stats
  - Cacluate my age
  - Extract information from my Resume
- Merge all the information
- Return the updated SVG code
- Finally, update the SVG on Github

<img width="1179" height="725" alt="image" src="https://github.com/user-attachments/assets/1e99a3fb-c7db-48c2-ac4e-648534dfba6c" />
