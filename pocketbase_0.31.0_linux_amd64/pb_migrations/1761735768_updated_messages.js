/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1339318284")

  // update field
  collection.fields.addAt(2, new Field({
    "hidden": false,
    "id": "bool4043038958",
    "name": "is_ai_response",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1339318284")

  // update field
  collection.fields.addAt(2, new Field({
    "hidden": false,
    "id": "bool4043038958",
    "name": "is_ai_response",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
})
