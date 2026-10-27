/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  function slugify(text) {
    if (!text) return ''
    return text
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-')
  }

  const projectsCollection = app.findCollectionByNameOrId("projects")
  try {
    if (!projectsCollection.fields.getByName("slug")) {
      projectsCollection.fields.add(new TextField({
        name: "slug"
      }))
      app.save(projectsCollection)
    }
  } catch {
    projectsCollection.fields.add(new TextField({
      name: "slug"
    }))
    app.save(projectsCollection)
  }

  const tasksCollection = app.findCollectionByNameOrId("tasks")
  try {
    if (!tasksCollection.fields.getByName("slug")) {
      tasksCollection.fields.add(new TextField({
        name: "slug"
      }))
      app.save(tasksCollection)
    }
  } catch {
    tasksCollection.fields.add(new TextField({
      name: "slug"
    }))
    app.save(tasksCollection)
  }

  const projects = app.findAllRecords("projects")
  const usedProjectSlugs = {}
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i]
    let baseSlug = slugify(p.getString("name")) || "project"
    let slug = baseSlug
    let count = 1
    while (usedProjectSlugs[slug]) {
      slug = baseSlug + "-" + count
      count++
    }
    usedProjectSlugs[slug] = true
    if (!p.getString("slug")) {
      p.set("slug", slug)
      app.save(p)
    }
  }

  const tasks = app.findAllRecords("tasks")
  const usedTaskSlugs = {}
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]
    const proj = t.getString("project")
    if (!usedTaskSlugs[proj]) {
      usedTaskSlugs[proj] = {}
    }
    let baseSlug = slugify(t.getString("title")) || "task"
    let slug = baseSlug
    let count = 1
    while (usedTaskSlugs[proj][slug]) {
      slug = baseSlug + "-" + count
      count++
    }
    usedTaskSlugs[proj][slug] = true
    if (!t.getString("slug")) {
      t.set("slug", slug)
      app.save(t)
    }
  }
}, (app) => {
  const projects = app.findCollectionByNameOrId("projects")
  if (projects) {
    projects.fields.removeByName("slug")
    app.save(projects)
  }
  const tasks = app.findCollectionByNameOrId("tasks")
  if (tasks) {
    tasks.fields.removeByName("slug")
    app.save(tasks)
  }
})
