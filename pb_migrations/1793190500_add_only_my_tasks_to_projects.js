/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("projects")
  collection.fields.add(new BoolField({
    name: "only_my_tasks"
  }))
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("projects")
  if (collection) {
    collection.fields.removeByName("only_my_tasks")
    return app.save(collection)
  }
})
