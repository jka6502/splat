(function() {


	var sync	= require('stratum-framework/lib/sync'),
		async	= sync.async;



	var newLine = '(?:\n\r|\r\n|\r|\n)',
		regex	= new RegExp('^\\s*---' + newLine + '([\\s|\\S]*?)' + newLine + '---');


	function FrontMatter(splat, options) {
		this.splat = splat;

		splat.on('content.file.pre', function(context, file) {
			var match = context.content.match(regex);
			if (match) {
				context.frontmatter = {
					raw: match[1]
				};
				context.content = match[2];
				sync(function() {
					splat.emit('content.file.frontmatter', context, file);
				});
			}
		});

	};


	module.exports = FrontMatter;


})();
