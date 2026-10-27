/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("tasks")

  try {
    if (!collection.fields.getByName("number")) {
      collection.fields.add(new NumberField({
        name: "number",
        min: 1,
        onlyInt: true
      }))
      app.save(collection)
    }
  } catch {
    collection.fields.add(new NumberField({
      name: "number",
      min: 1,
      onlyInt: true
    }))
    app.save(collection)
  }

  const tasks = app.findAllRecords("tasks")
  const byProject = {}
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]
    const projId = t.getString("project")
    if (!byProject[projId]) {
      byProject[projId] = []
    }
    byProject[projId].push(t)
  }

  for (const projId in byProject) {
    const list = byProject[projId]
    list.sort((a, b) => {
      const aCreated = a.getString("created")
      const bCreated = b.getString("created")
      return aCreated.localeCompare(bCreated)
    })
    for (let i = 0; i < list.length; i++) {
      const rec = list[i]
      if (!rec.getInt("number")) {
        rec.set("number", i + 1)
        app.save(rec)
      }
    }
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("tasks")
  if (collection) {
    collection.fields.removeByName("number")
    app.save(collection)
  }
})
