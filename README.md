Introduis dans la version 2.1 de mongodb, l' Aggregation Framework est une excellente alternative pour des operations que l'on pouvais faire avec map-reduce.
Plus simple que map-reduce, l'aggregation permet d'aggreger (serieux ?) des donnée pour un resortir des totaux, moyennes, min/max, etc...
Parfait pour des statistiques donc.

Dans cet article je vais utiliser des donnée provenant du site d'open-data de Paris (http://opendata.paris.fr/ Merci Paris) .
J'ai choisi la liste des "Arbres d'alignement" (https://www.google.com/fusiontables/exporttable?query=select%20*%20from%201YRLTX-GshQ7F9OJyt63KRkDsubPDO7YUoWYOOJo). Je pas vraiment d'idée sur ce que c'est, mais il y a 237 168 lignes, c'est deja pas mal.


== Combien il y a t'il d'arbres de chaque espece ?

Nous souhaitons grouper les espece d'arbres et connaitre leur noumbres.
Essayons en benchmarker 3 differentes techniques.

=== Js Pure

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

environ XXXms
Ce resultat vas nous servir de temps de reference.

=== Group

La methode *officiel* pour remplacer le GROUP BY d'sql est db.collection.group (http://docs.mongodb.org/manual/reference/method/db.collection.group/)

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
Environ XXXms

=== Framwork Aggreagate

Enfin nous testons avec le fameux framework d'aggregation

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

Environ XXXms

=== Tester chez vous

Vous pouvez tester chez vous en executant ces script
``npm install`` ``node tree_group_all.js setup`` puis ``node tree_group_all.js run -n 5``

== Conclusion

On remarque tout de suite que le Group() est quasiment 10x plus lent qu'avec l'aggregation.
Cela s'explique par le fait que Group est une extension de Map-Reduce et que Map-reduce gerer les données totalement differament du framework d'aggregation
(http://stackoverflow.com/questions/12337319/mongodb-aggregation-comparison-group-group-and-mapreduce)

On peux conclure que pour des groups relativement simple il est preferable d'utiliser le framework d'aggregation.
