const path = require("path");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
require("dotenv").config();

module.exports = {
  mode: "production",
  devtool: "source-map",
  entry: {
    background: "./src/background.js",
    content: "./src/content.js",
    popup: "./src/popup.js",
    login: "./src/login.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
  },
  resolve: {
    extensions: [".js"],
  },
  plugins: [
    new CleanWebpackPlugin(),
    new webpack.DefinePlugin({
      "process.env.API_DOMAIN": JSON.stringify(process.env.API_DOMAIN),
    }),
    new CopyPlugin({
      patterns: [
        { from: "src/manifest.json", to: "." },
        { from: "src/popup.html", to: "." },
        { from: "src/popup.css", to: "." },
        { from: "src/Icon1.png", to: "." },
        { from: "src/icon2.png", to: "." },
        { from: "src/login.html", to: "." },
      ],
    }),
  ],
};
