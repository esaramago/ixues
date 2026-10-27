/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("tasks")

  try {
    if (!collection.fields.getByName("relationships")) {
      collection.fields.add(new JSONField({
        name: "relationships"
      }))
      app.save(collection)
    }
  } catch {
    collection.fields.add(new JSONField({
      name: "relationships"
    }))
    app.save(collection)
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("tasks")
  if (collection) {
    collection.fields.removeByName("relationships")
    app.save(collection)
  }
})
