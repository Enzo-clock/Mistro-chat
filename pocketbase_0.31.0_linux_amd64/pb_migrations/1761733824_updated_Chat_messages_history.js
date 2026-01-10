/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1339318284")

  // update collection data
  unmarshal({
    "name": "messages"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1339318284")

  // update collection data
  unmarshal({
    "name": "Chat_messages_history"
  }, collection)

  return app.save(collection)
})
