/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("projects")

  try {
    if (!collection.fields.getByName("description")) {
      collection.fields.add(new TextField({
        name: "description"
      }))
      app.save(collection)
    }
  } catch {
    collection.fields.add(new TextField({
      name: "description"
    }))
    app.save(collection)
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("projects")
  if (collection) {
    collection.fields.removeByName("description")
    app.save(collection)
  }
})
