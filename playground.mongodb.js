db.getSiblingDB("test").users.updateMany(
  {
    ign: { $in: ["KITTU", "GAANJA"] },
  },
  {
    $set: { matchesPlayed: 1 },
  },
);
