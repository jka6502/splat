(function() {


	var Sokkit			= require('sokkit'),
		extend			= require('stratum-framework/lib/extend'),
		augment			= require('stratum-framework/lib/augment'),
		EventEmitter	= require('eventemitter2').EventEmitter2,
		glob			= require('glob'),
		path			= require('path'),
		fs				= require('fs'),
		sync			= require('stratum-framework/lib/sync'),
		then			= sync.then,
		async			= sync.async;


	var DEFAULT = {

		DATA:		{ path: 'data',		pattern: '**/*' },
		ASSETS:		{ path: 'assets',	pattern: '**/*', target:	'assets' },
		CONTENT:	{ path: 'content',	pattern: '**/*', targets:	['html'] },

		TEMPLATE:	'index.hbs'

	};


	var Splat = extend(function Splat(options) {
		EventEmitter.call(this, {wildcard: true});

		this.configure(options);
		this.init(options);

	}, EventEmitter, {


		init: function(options) {

			this.plugins = new Sokkit({
				path: [
					path.dirname(require.main.filename) + '/components/**/*.js',
					'$DEFAULT'
				]
			}).load();

			this.fail(this.plugins.failed,
				'Plugin Error: The following plugins failed to load');

			if (options.disable) {
				var disable = options.disable,
					plugins = this.plugins;

				if (!Array.isArray(disable) || !(disable instanceof Array)) {
					disable = [disable];
				}
				disable.forEach(function(plugin) { plugins.disable(plugin); });
			}

			errors = this.plugins.depend(function(module, plugin) {
				return plugin.requires;
			});

			this.fail(errors,
				'Plugin Error: The following plugins are missing dependencies', false);

			var errors = this.plugins.instantiate(this, options || {});

			this.fail(errors,
				'Plugin Error: The following plugins failed to initialise');

			this.emit('init', this);
		},


		run: function() {
			var splat	= this,
				root 	= { splat: this },
				context = this.context();

			context.options = this.options;

			sync(function() {

				splat.emit('run.pre', context);

				then(function() { splat.data(context);				});
				then(function() { splat.assets(context);			});
				then(function() { splat.contents(context);			});
				then(function() { splat.emit('run.post', context);	});

			});
		},


		context: function(base) {
			return Object.create((function Context() {}).prototype = base || {});
		},


		data: function(context) {

			var splat	= this,
				data	= this.options.data || DEFAULT.DATA,
				root	= path.resolve(this.options.path, data.path),
				pattern	= data.pattern || '**/*';

			context.data = {};

			sync(function() {

				splat.emit('data.pre', context);
			
				then(function() {

					glob(root + '/' + data.pattern, async(function(error, files) {
						(files || []).forEach(function(file) {
							fs.stat(file, async(function(error, stat) {
								if (error || stat.isDirectory()) { return; }
								splat.emit('data.file', context, file);
							}));
						});
					}));

				});

				then(function() { splat.emit('data.post', context); });

			});
 		},


		assets: function(context) {
			var splat	= this,
				assets	= this.options.assets || DEFAULT.ASSETS,
				root	= path.resolve(this.options.path, assets.path),
				pattern	= assets.pattern || '**/*';

			var details = context.assets = {
				reversed: []
			};

			sync(function() {

				var target	= context.build + path.separator
								+ (assets.target || DEFAULT.ASSETS.target);

				details.target = root;

				splat.emit('assets.pre', context);

				then(function() {
					glob(root + '/' + assets.pattern, async(function(error, files) {
						(files || []).forEach(function(file) {
							fs.stat(file, async(function(error, stat) {
								if (error || stat.isDirectory()) { return; }
								splat.asset(context, root, target, file);
							}));
						});
					}));
				});

				then(function() {
					details.reversed.sort();
					splat.emit('assets.post', context);
				});

			});

		},

		asset: function(context, root, target, file) {
			sync(function() {

				var reversed = file.split('').reverse().join('');
				context.assets.reversed.push(reversed);
				context.assets.reversed[reversed] = file;

				var local = splat.context(context)

				local.source		= file;
				local.destination	= target + path.separator
					+ path.relative(file, root);

				splat.emit('assets.file', local, file);

			});
		},

		contents: function(context) {
			var splat	= this,
				content	= this.options.content || DEFAULT.CONTENT;

			if (!(content instanceof Array) && !Array.isArray(content)) {
				content = [content];
			}

			sync(function() {

				splat.emit('content.pre', context);

				then(function() {

					content.forEach(function(group) {
						splat.group(splat.context(context), group);
					});

				});

				then(function() { splat.emit('content.post'); });

			});
		},


		group: function(context, group) {
			var splat	= this;

			context.group		= group;
			context.template	= group.template || DEFAULT.TEMPLATE;

			sync(function() {

				splat.emit('content.group.pre', context);

				then(function() {

					var root	= path.resolve(splat.options.path, group.path
									|| DEFAULT.CONTENT.path),
						pattern = (group.pattern || DEFAULT.CONTENT.pattern);

					glob(root + '/' + pattern, async(function(error, files) {

						(files || []).forEach(function(file) {
							splat.file(splat.context(context), group, file);
						});

					}));

				});

				then(function() { splat.emit('content.group.post', context); });

			});
		},


		file: function(context, group, file) {
			context.file		= path.basename(file);
			context.path		= path.relative(path.dirname(file), group.path);
			context.type		= path.extname(file);

			sync(function() {

				fs.readFile(file, { encoding: 'utf8' }, async(function(error, data) {
					if (error) {
						splat.emit('content.file.error', context, error);
						return;
					}

					context.content = data;

				}));

				then(function() { splat.emit('content.file.pre', context);	});
				then(function() { splat.emit('content.file', context);		});
				then(function() { splat.emit('content.file.post', context);	});

			});
		},


		fail: function(errors, message, showStack) {
			if (errors.length) {
				console.warn(message);
				errors.forEach(function(fail) {
					console.warn('   %s: %s', fail.name, showStack === false
							? fail.error.message : fail.error.stack);
				});
			}
		},


		configure: function(options, base) {
			this.options	= options = options || {};
			options.path	= (options.path || process.cwd()).replace(/\\/g, '/');
		},


	});


	module.exports = Splat;

	var splat = new Splat({
//		disable: ['frontmatter']
	});

	splat.onAny(function() {
		console.warn(this.event);
	});


	splat.run();

})();