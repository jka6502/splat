(function() {


	var yaml	= require('js-yaml'),
		augment	= require('stratum-framework/lib/augment');


	function FrontMatterYAML(splat) {
		this.splat = splat;

		splat.on('content.file.frontmatter', function(context, file) {
			augment(context.frontmatter, yaml.safeLoad(context.frontmatter.raw));
			console.log(context.frontmatter);
		});
	};

	FrontMatterYAML.requires = ['frontmatter'];


	module.exports = FrontMatterYAML;


})();
