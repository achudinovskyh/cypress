
import commonConfig, { HtmlWebpackPlugin, CopyWebpackPlugin, webpack } from '@packages/web-config/webpack.config.base'
import path from 'path'

const config: typeof commonConfig = {
	...commonConfig,
	entry: {
		app: [path.resolve(__dirname, 'src/main')],
	},
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: '[name].js',
		devtoolModuleFilenameTemplate: '[namespace]/[resource-path]'
	},
}

config.plugins = [
	...config.plugins!,
	new HtmlWebpackPlugin({
		template: path.resolve(__dirname, './src/index.html'),
		inject: false,
	}),
]

config.resolve = {
	...config.resolve,
	// alias: {
	// 	'react': require.resolve('react')
	// },
}


export default config

