/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("tasks")

  try {
    if (!collection.fields.getByName("labels")) {
      collection.fields.add(new JSONField({
        name: "labels"
      }))
      app.save(collection)
    }
  } catch {
    collection.fields.add(new JSONField({
      name: "labels"
    }))
    app.save(collection)
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("tasks")
  if (collection) {
    collection.fields.removeByName("labels")
    app.save(collection)
  }
})
