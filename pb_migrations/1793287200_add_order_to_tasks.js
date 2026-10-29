/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("tasks")

  collection.fields.add(new NumberField({
    name: "order",
    min: 0,
    onlyInt: true
  }))

  app.save(collection)

  const tasks = app.findAllRecords("tasks")
  const byProjectAndStatus = {}

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]
    const projId = t.getString("project")
    const statusId = t.getString("status") || "none"
    const groupKey = projId + ":" + statusId

    if (!byProjectAndStatus[groupKey]) {
      byProjectAndStatus[groupKey] = []
    }
    byProjectAndStatus[groupKey].push(t)
  }

  for (const groupKey in byProjectAndStatus) {
    const list = byProjectAndStatus[groupKey]
    list.sort((a, b) => {
      const aNum = a.getInt("number")
      const bNum = b.getInt("number")
      if (aNum !== bNum) {
        return aNum - bNum
      }
      return a.getString("created").localeCompare(b.getString("created"))
    })

    for (let i = 0; i < list.length; i++) {
      const rec = list[i]
      rec.set("order", i)
      app.save(rec)
    }
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("tasks")
  if (collection) {
    collection.fields.removeByName("order")
    app.save(collection)
  }
})
