# L'agrégation de données avec MongoDb

Il existe différentes façons d'agréger des données avec Mongodb. Dans cet article, nous allons le faire de 3 façons différentes et les comparer.

Je vais utiliser des données provenant du site d'[open-data](http://opendata.paris.fr/) de Paris.
J'ai choisi la liste des "Arbres d'alignement" (https://www.google.com/fusiontables/exporttable?query=select%20*%20from%201YRLTX-GshQ7F9OJyt63KRkDsubPDO7YUoWYOOJo). Je n'ai pas vraiment d'idée sur ce que c'est, mais il y a 237 168 lignes, c'est déjà pas mal.

## Combien y a t'il d'arbres de chaque espèce ?

Nous souhaitons grouper les espèces d'arbres et connaitre leurs quantités respectives.
Essayons en benchmarker 3 différentes techniques: JS pur, [Group()](http://docs.mongodb.org/manual/reference/command/group/) et [Aggregate](http://docs.mongodb.org/manual/reference/command/aggregate/#dbcmd.aggregate)

### Js Pure

La première approche est de grouper avec uniquement JavaScript. On récupère toutes nos données. On itère dessus et on classe le tout dans un objet

```
Mongo.connect("mongodb://localhost:27017/aggregation_test?w=1", function(err, db) {
  var collection = db.collection('tree');
  var start = Date.now();
  collection.find({}, {genre: 1}).toArray(function(err, doc){
    var result = [];
    doc.forEach(function(tree){
      if (result[tree.genre] === undefined) {
        result[tree.genre] = {};
        result[tree.genre].totalByGenre = 1;
      } else {
        result[tree.genre].totalByGenre++;
      }
    });
    console.log(Date.now() - start)
  });
});
```

Environ 600ms
Ce résultat va nous servir de temps de référence.

### Group

La méthode *officielle* pour remplacer le GROUP BY d'sql est ``db.collection.group``.
http://docs.mongodb.org/manual/reference/method/db.collection.group/

```
Mongo.connect("mongodb://localhost:27017/aggregation_test?w=1", function(err, db) {
  var collection = db.collection('tree');
  var start = Date.now();

  collection.group(
    ['genre'],
    {},
    { totalByGenre: 0 },
    function ( curr, result ) {
      result.totalByGenre += 1;
    },
    function (err, result) {
      console.log(Date.now() - start)
    });
});
```
Environ 3.5s (secondes !)

### Framework d'Aggreagation

Enfin nous testons avec le fameux framework d'agregation

Introduit dans la version 2.1 de MongoDb, le [http://docs.mongodb.org/manual/core/aggregation/](framework d'agregation<) est une excellente alternative pour les opérations que l'on pouvait faire avec map-reduce.
Plus simple que map-reduce, l'agrégation permet d'agréger (sérieux ?) des données pour un ressortir des totaux, moyennes, min/max, etc...
Parfait pour des statistiques.

```
Mongo.connect("mongodb://localhost:27017/aggregation_test?w=1", function(err, db) {
  var collection = db.collection('tree');
  var start = Date.now();
  collection.aggregate(
  {
    $project : {
      genre: 1
    }
  }, {
    $group : {
      _id: '$genre',
      totalByGenre: { $sum: 1}
    }
  },{
    $sort: {totalByGenre: -1}
  }, function(err, result) {
    aggregationTime.push(Date.now() - start);
    again(null);
  });
});
```

Environ 350ms.

### Tester chez vous

Vous pouvez tester chez vous en clonant le dépôt

```
git clone https://github.com/LaBelleAssiette/mongodb_group_test
cd mongodb_group_test
npm install
node tree_group_all.js setup
node tree_group_all.js run -n 5
```

## Conclusion

On remarque tout de suite que le Group() est 10x plus lent qu'avec l'agrégation.
Cela s'explique par le fait que Group est une extension de Map-Reduce et que Map-reduce gerer les données totalement différemment du framework d'agrégation
(http://stackoverflow.com/questions/12337319/mongodb-aggregation-comparison-group-group-and-mapreduce)

On peux conclure que pour des opérations de groupage ou faire des sommes/moyennes/etc relativement simple il est préférable d'utiliser le framework d'agrégation.
