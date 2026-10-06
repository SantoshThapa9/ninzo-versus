db.users.updateMany({}, [
  {
    $set: {
      matchesPlayed: {
        $max: [
          {
            $subtract: [
              {
                $convert: {
                  input: "$matchesPlayed",
                  to: "int",
                  onError: 0,
                  onNull: 0,
                },
              },
              1,
            ],
          },
          0,
        ],
      },
    },
  },
]);
