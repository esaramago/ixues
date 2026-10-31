/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const existing = app.findCollectionByNameOrId("user_tokens")
    if (existing) {
      return
    }
  } catch {
    // Collection does not exist yet
  }

  const collection = new Collection({
    type: "base",
    name: "user_tokens",
    listRule: "@request.auth.id != '' && user = @request.auth.id",
    viewRule: "@request.auth.id != '' && user = @request.auth.id",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != '' && user = @request.auth.id",
    deleteRule: "@request.auth.id != '' && user = @request.auth.id",
    fields: [
      {
        name: "name",
        type: "text"
      },
      {
        name: "provider",
        type: "select",
        required: true,
        values: ["github", "jira"],
        maxSelect: 1
      },
      {
        name: "token",
        type: "text",
        required: true
      },
      {
        name: "user",
        type: "relation",
        collectionId: "_pb_users_auth_",
        cascadeDelete: true,
        maxSelect: 1,
        required: true
      },
      {
        name: "created",
        type: "autodate",
        onCreate: true
      },
      {
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true
      }
    ]
  })

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("user_tokens")
    if (collection) {
      app.delete(collection)
    }
  } catch {
    // Collection not found
  }
})
