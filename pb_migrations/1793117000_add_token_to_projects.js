/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("projects")

  try {
    if (!collection.fields.getByName("token")) {
      collection.fields.add(new TextField({
        name: "token"
      }))
      app.save(collection)
    }
  } catch {
    collection.fields.add(new TextField({
      name: "token"
    }))
    app.save(collection)
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("projects")
  if (collection) {
    collection.fields.removeByName("token")
    app.save(collection)
  }
})
