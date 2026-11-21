db.users.updateMany(
  {},
  {
    $unset: {
      matchesPlayed: "",
      wins: ""
    }
  }
);
