/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects")
  const userTokens = app.findCollectionByNameOrId("user_tokens")

  if (projects && userTokens) {
    try {
      if (!projects.fields.getByName("user_token")) {
        projects.fields.add(new RelationField({
          name: "user_token",
          collectionId: userTokens.id,
          cascadeDelete: false,
          maxSelect: 1
        }))
        app.save(projects)
      }
    } catch {
      projects.fields.add(new RelationField({
        name: "user_token",
        collectionId: userTokens.id,
        cascadeDelete: false,
        maxSelect: 1
      }))
      app.save(projects)
    }
  }
}, (app) => {
  const projects = app.findCollectionByNameOrId("projects")
  if (projects) {
    try {
      projects.fields.removeByName("user_token")
      app.save(projects)
    } catch {}
  }
})
