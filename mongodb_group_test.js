var Mongo = require('mongodb'),
Table = require('cli-table'),
Program = require('nomnom'),
fs = require('fs'),
readline = require('readline'),
async = require('async');

var nTimes = 1;
var mongoDb_url = 'localhost';
var mongoDb_port = 27017;
var mongoDb_base = 'aggregation_test';

var nativeTime = [];
var groupTime = [];
var aggregationTime = [];

function setupMongoDB () {
	var start = Date.now();
	Mongo.connect("mongodb://"+mongoDb_url+":"+mongoDb_port+"/"+mongoDb_base+"?w=1", function(err, db) {
		db.dropDatabase(function(err, result){
			fs.readFile('./OK Arbres d\'alignement - Données géographiques.csv', 'ascii', function(err, data){
				if (err) {
					throw err;
				} else {
					var lines = data.split('\n');
					var collection = new Mongo.Collection(db, 'tree');
					lines.shift();
					async.each(lines, function(line, cb){
						if (line !== "") {
							var tree = line.split(',');
							collection.insert({
								genre: tree[1],
								hauteur: tree[5],
								Lib_Type_E: tree[6],
								Lib_Etat_C: tree[7]
							}, function(err) {
								cb(err);
							});
						}
					}, function(err){
						if (err) {
							console.warn(err);
						}
						console.log('Finish in %d ms', Date.now() - start);
						db.close();
						process.exit(0);
					});
				}
			});
		});
	});
}

function setupMongoDB_fast () {
	var start = Date.now();
	Mongo.connect("mongodb://"+mongoDb_url+":"+mongoDb_port+"/"+mongoDb_base+"?w=1", function(err, db) {
		db.dropDatabase(function(err, result){
			var collection = new Mongo.Collection(db, 'tree');
			var rd = readline.createInterface({
				input: fs.createReadStream('./OK Arbres d\'alignement - Données géographiques.csv', 'ascii'),
				output: process.stdout,
				terminal: false
			});

			rd.on('line', function (line) {
				if (line !== "") {
					var tree = line.split(',');
					collection.insert({
						genre: tree[1],
						hauteur: tree[5],
						Lib_Type_E: tree[6],
						Lib_Etat_C: tree[7]
					}, function(err) {
						cb(err);
					});
				}
			});

			rd.on('close', function () {
				console.log('Finish in %d ms', Date.now() - start);
				db.close();
				process.exit(0);
			});

		});
	});
}

function run () {
	function runTest (db, collection) {
		async.waterfall([
			function (next) {
				console.log('Group with pure js');
				async.timesSeries(
					nTimes,
					function (n, again) {
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
							nativeTime.push(Date.now() - start);
							again(null);
						});
					},
					function (err, times) {
						next(null);
					}
				);
			},
			function (next) {
				/*

					db.runCommand({
						group: {
							ns: 'tree',
							key: { genre: 1},
							$reduce: function ( curr, result ) {
								result.totalByGenre++;
							},
							initial: { totalByGenre : 0 }
						}
					})

				*/
				console.log('Group with group mongodb');

				async.timesSeries(nTimes, function (n, again){
					var start = Date.now();
					var time = Date.now();
					collection.group(
						['genre'],
						{},
						{ totalByGenre: 0 },
						function ( curr, result ) {
							result.totalByGenre += 1;
						},
						function (err, result) {
							groupTime.push(Date.now() - start);
							again(null);
						});

				}, function (err, times) {
					next(null);
				});
			},
			function (next) {
				console.log('Group with aggregate mongodb');

				async.timesSeries(nTimes, function (n, again){
					var start = Date.now();
					var time = Date.now();
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

				}, function (err, times) {
					next(null);
				});
			}
		], function () {
			var t = new Table({
				head: ['Method', 'avg time (ms)']
			});

			t.push(['Pure js', Math.round( nativeTime.reduce(function (a, b) {return a + b;}) / nativeTime.length * 100 ) / 100 ]);
			t.push(['Group', Math.round( groupTime.reduce(function (a, b) {return a + b;}) / groupTime.length * 100 ) / 100 ]);
			t.push(['Aggregation', Math.round( aggregationTime.reduce(function (a, b) {return a + b;}) / aggregationTime.length * 100) / 100]);
			console.log(t.toString());
			process.exit(0);
		});
	}

	Mongo.connect("mongodb://"+mongoDb_url+":"+mongoDb_port+"/"+mongoDb_base+"?w=1", function(err, db) {
		if (err) {
			throw err;
		}

		var collection = db.collection('tree');
		console.log('Run %d times each method', nTimes);
		runTest(db, collection);
	});
}

Program
	.command('setup')
		.callback(setupMongoDB)
		.help('Setup MongoDB databases');

Program
	.command('run')
		.callback(run)
		.option('nTime', {
			abbr: 'n',
			full: 'n-times',
			callback: function (n) {
				nTimes = n;
			}
		})
		.help('Run benchmark test');

Program.parse();
