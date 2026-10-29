## Purpose
Ixues is an issue and task tracking web application.

## Description
Esta app faz a sincronização de outras ferramentas com issue tracking (Jira, GitHub, etc) ou utiliza projetos internos.

### Project
1. O user X faz login
2. Cria um projeto
    - Escolhe o nome do projeto
    - Diz se é do tipo "Sincronização" ou "Local"
    - Se for "Sincronização", escolhe o provider (GitHub, Jira, etc) e adiciona o url do repositório (https://your-domain.atlassian.net, https://github.com/user/repository)
3. O projeto criado aparece numa sidebar
4. O projeto depende das tabelas `user`, `tasks`, `statuses`, `providers` e `sprint`

### Kanban
1. O user X faz login e clica no projeto na sidebar
2. É construído um kanban com base nos `statuses` em colunas e nas `tasks` da BD offline
3. É iniciada uma sincronização com o PocketBase, no caso de projetos locais, ou com a API do provider, caso seja um projeto sincronizado.
#### Considerações dos `statuses`
- Os projetos sincronizados usam os estados configurados no provider. Não é possível apagar nem criar novos.
- Para os projetos locais, é necessário criar estados (backlog, todo, doing, done, etc)

### Issues
1. O user X faz login, clica no projeto na sidebar e aparece o kanban com os cards dos issues.
2. O user pode abrir um card, abrindo uma popup com dados (título, prioridade, descrição, attachments, responsável, sprint, labels, relação com outro issue, branches, etc)
5. O user faz alterações.
    - É gravado offline
    - Se for um projeto sincronizado, grava para o respetivo repositório.
    - Se for local, grava na bd
6. De x em x tempo, o projeto aberto verifica se há alterações no provider.

### Considerações de segurança
- Prefiro não guardar os dados das `tasks` de projetos sincronizados na BD. Os dados visualizados devem ser sempre locais

## Rules
- No Tailwind or other CSS frameworks.
- Do not add inline styles.
- Use the Grid.svelte component whenever possible to structure layout.
- Use WebAwesome for elements whenever possible.
- Do not write CSS or add unnecessary classes. I will write whatever CSS is needed.
- Do not use redundant attributes. Example: `<Grid gap="m" />`
- Code comments must be in English.
- README.md and AGENTS.md must be in English.
- Do not commit any changes.
- Avoid repeating code. Create reusable functions and components when it makes sense.
- Files use 2 spaces indentation

## Notes
- This project is hosted on Coolify.
- Issues tracking in https://ixues.emanuelsaramago.com/share/5a5c85bd7055968ee0db82bc56a90809