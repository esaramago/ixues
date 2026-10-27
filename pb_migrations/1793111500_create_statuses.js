/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects")

  const collection = new Collection({
    type: "base",
    name: "statuses",
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
        name: "project",
        type: "relation",
        collectionId: projects.id,
        cascadeDelete: true,
        maxSelect: 1,
        required: true
      },
      {
        name: "order",
        type: "number",
        min: 0
      },
      {
        name: "color",
        type: "text"
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
  const collection = app.findCollectionByNameOrId("statuses")
  if (collection) {
    app.delete(collection)
  }
})
