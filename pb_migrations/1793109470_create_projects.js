/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "projects",
    listRule: "@request.auth.id != '' && user = @request.auth.id",
    viewRule: "@request.auth.id != '' && user = @request.auth.id",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != '' && user = @request.auth.id",
    deleteRule: "@request.auth.id != '' && user = @request.auth.id",
    fields: [
      {
        name: "name",
        type: "text",
        required: true
      },
      {
        name: "type",
        type: "select",
        required: true,
        values: ["local", "sync"],
        maxSelect: 1
      },
      {
        name: "provider",
        type: "text"
      },
      {
        name: "repo_url",
        type: "url"
      },
      {
        name: "user",
        type: "relation",
        collectionId: "_pb_users_auth_",
        cascadeDelete: true,
        maxSelect: 1,
        required: true
      }
    ]
  })

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("projects")
  if (collection) {
    app.delete(collection)
  }
})
