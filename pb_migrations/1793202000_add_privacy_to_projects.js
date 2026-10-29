/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects")
  try {
    if (!projects.fields.getByName("privacy")) {
      projects.fields.add(new SelectField({
        name: "privacy",
        values: ["private", "public"],
        maxSelect: 1
      }))
    }
  } catch {
    projects.fields.add(new SelectField({
      name: "privacy",
      values: ["private", "public"],
      maxSelect: 1
    }))
  }
  projects.listRule = "privacy = 'public' || (@request.auth.id != '' && user = @request.auth.id)"
  projects.viewRule = "privacy = 'public' || (@request.auth.id != '' && user = @request.auth.id)"
  app.save(projects)

  const statuses = app.findCollectionByNameOrId("statuses")
  if (statuses) {
    statuses.listRule = "project.privacy = 'public' || (@request.auth.id != '' && user = @request.auth.id)"
    statuses.viewRule = "project.privacy = 'public' || (@request.auth.id != '' && user = @request.auth.id)"
    app.save(statuses)
  }

  const tasks = app.findCollectionByNameOrId("tasks")
  if (tasks) {
    tasks.listRule = "project.privacy = 'public' || (@request.auth.id != '' && user = @request.auth.id)"
    tasks.viewRule = "project.privacy = 'public' || (@request.auth.id != '' && user = @request.auth.id)"
    app.save(tasks)
  }
}, (app) => {
  const projects = app.findCollectionByNameOrId("projects")
  if (projects) {
    projects.fields.removeByName("privacy")
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
