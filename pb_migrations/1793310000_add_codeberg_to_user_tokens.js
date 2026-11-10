/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("user_tokens")
  const field = collection.fields.getByName("provider")
  if (field) {
    field.values = ["github", "jira", "codeberg"]
  }
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("user_tokens")
  if (collection) {
    const field = collection.fields.getByName("provider")
    if (field) {
      field.values = ["github", "jira"]
    }
    return app.save(collection)
  }
})
