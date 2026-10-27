/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("tasks")

  try {
    if (!collection.fields.getByName("assigned")) {
      collection.fields.add(new RelationField({
        name: "assigned",
        collectionId: "_pb_users_auth_",
        cascadeDelete: false,
        maxSelect: 1
      }))
      app.save(collection)
    }
  } catch {
    collection.fields.add(new RelationField({
      name: "assigned",
      collectionId: "_pb_users_auth_",
      cascadeDelete: false,
      maxSelect: 1
    }))
    app.save(collection)
  }

  try {
    const users = app.findCollectionByNameOrId("_pb_users_auth_")
    if (users && users.listRule === "id = @request.auth.id") {
      users.listRule = "@request.auth.id != ''"
      users.viewRule = "@request.auth.id != ''"
      app.save(users)
    }
  } catch (err) {
    console.error("Failed to update users rules:", err)
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("tasks")
  if (collection) {
    collection.fields.removeByName("assigned")
    app.save(collection)
  }
})
