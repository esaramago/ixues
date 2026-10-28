/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("statuses")

  try {
    if (!collection.fields.getByName("key")) {
      collection.fields.add(new TextField({
        name: "key"
      }))
      app.save(collection)
    }
  } catch {
    collection.fields.add(new TextField({
      name: "key"
    }))
    app.save(collection)
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("statuses")
  if (collection) {
    collection.fields.removeByName("key")
    app.save(collection)
  }
})
