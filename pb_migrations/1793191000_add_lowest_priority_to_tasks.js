/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("tasks")
  const field = collection.fields.getByName("priority")
  if (field) {
    field.values = ["lowest", "low", "medium", "high", "urgent"]
  }
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("tasks")
  if (collection) {
    const field = collection.fields.getByName("priority")
    if (field) {
      field.values = ["low", "medium", "high", "urgent"]
    }
    return app.save(collection)
  }
})
