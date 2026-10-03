db.getSiblingDB("test").users.updateMany(
  {
    wins: { $exists: true },
  },
  {
    $set: { wins: 0 },
  },
);
