/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects")
  const statuses = app.findCollectionByNameOrId("statuses")

  const collection = new Collection({
    type: "base",
    name: "tasks",
    listRule: "@request.auth.id != '' && user = @request.auth.id",
    viewRule: "@request.auth.id != '' && user = @request.auth.id",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != '' && user = @request.auth.id",
    deleteRule: "@request.auth.id != '' && user = @request.auth.id",
    fields: [
      {
        name: "number",
        type: "number",
        min: 1,
        onlyInt: true
      },
      {
        name: "title",
        type: "text",
        required: true
      },
      {
        name: "description",
        type: "text"
      },
      {
        name: "priority",
        type: "select",
        values: ["low", "medium", "high", "urgent"],
        maxSelect: 1
      },
      {
        name: "status",
        type: "relation",
        collectionId: statuses ? statuses.id : "statuses",
        cascadeDelete: false,
        maxSelect: 1
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
  const collection = app.findCollectionByNameOrId("tasks")
  if (collection) {
    app.delete(collection)
  }
})
