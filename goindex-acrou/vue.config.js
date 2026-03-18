const path = require("path");
// 建议：如果不需要 CDN，可以不再引用 dependencies-cdn
const BuildAppJSPlugin = require("./buildAppJSPlugin");
const CompressionWebpackPlugin = require("compression-webpack-plugin");
const { set } = require("lodash");

function resolve(dir) {
  return path.join(__dirname, dir);
}

// 增加环境变量
process.env.VUE_APP_VERSION = require("./package.json").version;
process.env.VUE_APP_G2INDEX_VERSION = require("./package.json").g2index;

// --- 核心修改点 1: 固定 PublicPath ---
// 不再依赖不确定的环境变量，直接指向你的 GitHub Pages 地址
const isProd = process.env.NODE_ENV === "production";
let publicPath = isProd ? "https://yenkj.github.io/goindex/" : "/";

module.exports = {
  publicPath,
  lintOnSave: true,
  css: {
    loaderOptions: {
      sass: {
        // --- 核心修改点 2: 修正 Sass 变量路径 ---
        prependData: `$cdnPath: "${publicPath}";`,
      },
    },
  },
  configureWebpack: (config) => {
    const configNew = {};
    if (isProd) {
      // --- 核心修改点 3: 禁用 Externals ---
      // 注释掉下面这行，让 Webpack 把 Vue, Vuex, Axios 等全部打包进 js 文件
      // configNew.externals = externals; 
      
      configNew.plugins = [
        new CompressionWebpackPlugin({
          filename: "[path].gz[query]",
          test: new RegExp("\\.(" + ["js", "css"].join("|") + ")$"),
          threshold: 10240,
          minRatio: 0.8,
          deleteOriginalAssets: false,
        }),
      ];
    }
    return configNew;
  },

  chainWebpack: (config) => {
    config.plugin("BuildAppJSPlugin").use(BuildAppJSPlugin);

    config.plugin("html").tap((options) => {
      // --- 核心修改点 4: 简化 HTML 注入 ---
      // 既然不使用外部 CDN，我们将 inject 设为 true，让 Webpack 自动插入打包好的脚本
      set(options, "[0].inject", true);
      if (isProd) {
        // 清空 cdn 配置，防止插件重复插入旧的脚本
        set(options, "[0].cdn", { css: [], js: [] });
      }
      return options;
    });

    if (isProd) {
      config.plugins.delete("prefetch").delete("preload");
    }

    config.resolve.symlinks(true);
    config.resolve.alias
      .set("@", resolve("src"))
      .set("@assets", resolve("src/assets"))
      .set("@utils", resolve("src/utils"))
      .set("@api", resolve("src/api"))
      .set("@node_modules", resolve("node_modules"));

    if (process.env.npm_config_report) {
      config
        .plugin("webpack-bundle-analyzer")
        .use(require("webpack-bundle-analyzer").BundleAnalyzerPlugin);
    }
  },

  productionSourceMap: false,

  devServer: {
    publicPath,
    proxy: {
      "/api": {
        target: "https://ossdev.achirou.workers.dev/",
        ws: true,
        changeOrigin: true,
        pathRewrite: {
          "^/api": "",
        },
      },
    },
  },

  pluginOptions: {
    i18n: {
      locale: "zh-chs",
      localeDir: "locales",
      enableInSFC: true,
    },
  },
};
