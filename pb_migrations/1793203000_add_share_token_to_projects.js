/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects")
  try {
    if (!projects.fields.getByName("share_token")) {
      projects.fields.add(new TextField({
        name: "share_token"
      }))
    }
  } catch {
    projects.fields.add(new TextField({
      name: "share_token"
    }))
  }

  projects.listRule = "user = @request.auth.id || (privacy = 'public' && share_token != '')"
  projects.viewRule = "user = @request.auth.id || (privacy = 'public' && share_token != '')"
  app.save(projects)

  const statuses = app.findCollectionByNameOrId("statuses")
  if (statuses) {
    statuses.listRule = "user = @request.auth.id || (project.privacy = 'public' && project.share_token != '')"
    statuses.viewRule = "user = @request.auth.id || (project.privacy = 'public' && project.share_token != '')"
    app.save(statuses)
  }

  const tasks = app.findCollectionByNameOrId("tasks")
  if (tasks) {
    tasks.listRule = "user = @request.auth.id || (project.privacy = 'public' && project.share_token != '')"
    tasks.viewRule = "user = @request.auth.id || (project.privacy = 'public' && project.share_token != '')"
    app.save(tasks)
  }
}, (app) => {
  const projects = app.findCollectionByNameOrId("projects")
  if (projects) {
    projects.fields.removeByName("share_token")
    projects.listRule = "@request.auth.id != '' && user = @request.auth.id"
    projects.viewRule = "@request.auth.id != '' && user = @request.auth.id"
    app.save(projects)
  }

  const statuses = app.findCollectionByNameOrId("statuses")
  if (statuses) {
    statuses.listRule = "@request.auth.id != '' && user = @request.auth.id"
    statuses.viewRule = "@request.auth.id != '' && user = @request.auth.id"
    app.save(statuses)
  }

  const tasks = app.findCollectionByNameOrId("tasks")
  if (tasks) {
    tasks.listRule = "@request.auth.id != '' && user = @request.auth.id"
    tasks.viewRule = "@request.auth.id != '' && user = @request.auth.id"
    app.save(tasks)
  }
})
