/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("tasks")

  try {
    if (!collection.fields.getByName("branches")) {
      collection.fields.add(new JSONField({
        name: "branches"
      }))
      app.save(collection)
    }
  } catch {
    collection.fields.add(new JSONField({
      name: "branches"
    }))
    app.save(collection)
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("tasks")
  if (collection) {
    collection.fields.removeByName("branches")
    app.save(collection)
  }
})
