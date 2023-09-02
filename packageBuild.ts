#!/usr/bin/env node

/**
 * 
 * Credits: Dirtbikercj
 * 
 */

const fs = require("fs-extra");
const glob = require("glob");
const zip = require("bestzip");
const path = require("path");
const minimatch = require("minimatch");
const chalk = require("chalk");
const processHost = require("child_process")

const { author, name:packageName, version } = require("./package.json");

const configText = fs.readFileSync("./build.json");
const config = JSON.parse(configText);
const currentDir = __dirname;

const modName = `${author.replace(/[^a-z0-9]/gi, "")}-${packageName.replace(/[^a-z0-9]/gi, "")}`;

const currentDate = new Date();
const epoch = `${currentDate}`

console.log(`[SPT build System] ${epoch}`);
if (config.GitStatus === true)
{
    const gitStatus = processHost.execSync("git status -uno", {encoding: "utf-8"})
    console.log(gitStatus);
}
console.log("[SPT Build System] Build options:");
console.log(`[SPT Build System] CopyToGame:     ${config.CopyToGame}`);
console.log(`[SPT Build System] PathToRoot:     ${config.PathToRoot}`);
console.log(`[SPT Build System] BuildDir:       ${config.BuildDir}`);
console.log(`[SPT Build System] CopyBundles:    ${config.CopyBundles}`);
console.log(`[SPT Build System] BuildZip:       ${config.BuildZip}`);
console.log(`[SPT Build System] StartServer:    ${config.StartServer}`);
console.log(`[SPT Build System] StartDelay:     ${config.StartDelay}`);
console.log(`[SPT Build System] Generated package name: ${modName}`);

if (config.FirstRun)
{
    // First run on new build system, remove dist folder.
    fs.rmSync(`${currentDir}\\dist`, { force: true, recursive: true });
    console.log(chalk.yellow("[SPT Build System] First time running npm build"));
    console.log(chalk.yellow("[SPT Build System] Please configure the build.json file"));
    console.log(chalk.yellow("[SPT Build System] Disable this warning by disabling FirstRun in build.json"));
    process.exit(1);
}

fs.rmSync(`${currentDir}\\${config.BuildDir}`, { force: true, recursive: true });
console.log(chalk.green("[SPT Build System] Previous build files deleted."));

const ignoreList = [
    "node_modules/",
    // "node_modules/!(weighted|glob)", // Instead of excluding the entire node_modules directory, allow two node modules.
    //"src/**/*.js",
    "types/",
    ".git/",
    ".gitea/",
    ".eslintignore",
    ".eslintrc.json",
    ".gitignore",
    ".DS_Store",
    "packageBuild.ts",
    "mod.code-workspace",
    "package-lock.json",
    "tsconfig.json",
    "build.json"
];

const ignoreListNoBundles = [
    "bundles/",
    "node_modules/",
    // "node_modules/!(weighted|glob)", // Instead of excluding the entire node_modules directory, allow two node modules.
    //"src/**/*.js",
    "types/",
    ".git/",
    ".gitea/",
    ".eslintignore",
    ".eslintrc.json",
    ".gitignore",
    ".DS_Store",
    "packageBuild.ts",
    "mod.code-workspace",
    "package-lock.json",
    "tsconfig.json",
    "build.json"
];

let exclude;
if (config.CopyBundles === true)
{
    exclude = glob.sync(`{${ignoreList.join(",")}}`, { realpath: true, dot: true });
}
else
{
    exclude = glob.sync(`{${ignoreListNoBundles.join(",")}}`, { realpath: true, dot: true });
}

fs.copySync(currentDir, path.normalize(`${currentDir}/../~${modName}`), {filter: (src) =>
{
    const relativePath = path.relative(currentDir, src);
    const shouldExclude = exclude.some((pattern) => minimatch(relativePath, pattern));
    return !shouldExclude;
}});

fs.moveSync(path.normalize(`${currentDir}/../~${modName}`), path.normalize(`${currentDir}/${modName}`), { overwrite: true });
fs.copySync(path.normalize(`${currentDir}/${modName}`), path.normalize(`${currentDir}/${config.BuildDir}`));

if (config.BuildZip === false)
{
    // If we are not building the zip, remove the tmp directory
    fs.rmSync(`${currentDir}/${modName}`, { force: true, recursive: true });
}

console.log(chalk.green(`[SPT Build System] Server files built. ${config.BuildDir} directory contains your newly built files`));

if (config.CopyToGame)
{
    // Delete the existing build before we copy the new build over.
    fs.rmSync(`${config.PathToRoot}/user/mods/${modName}`, { force: true, recursive: true });
    console.log(chalk.green("[SPT Build System] Server files deleted in game directory."));

    const gamePath = path.normalize(`${config.PathToRoot}/user/mods/${modName}`)

    // Copy files to the game directory
    fs.copySync(path.normalize(`${currentDir}/${config.BuildDir}`), gamePath);
    console.log(chalk.green(`[SPT Build System] Server files copied to game path: ${gamePath}`));
}

if (config.BuildZip)
{
    // const representing the root of the drive for the executing process.
    const rootPathC = path.parse(process.cwd()).root;

    // Create the temporary user/mod path
    const relativeZipPath = path.normalize(path.join(`${rootPathC}/`, "user/", "mods/"));
    fs.mkdir(relativeZipPath, { recursive: true }, (err) => 
    {
        if (err) 
        {
            console.error(chalk.red(`[SPT Build System] A error has occurred creating directory ${relativePath}: `, err.stack), err);
        }
    });
    
    // copy the temp build directory into the temporary user/mod directory
    fs.copySync(path.normalize(`${currentDir}/${modName}`), path.normalize(`${relativeZipPath}/${modName}`));

    zip({
        source: `${relativeZipPath}\\${modName}\\`,
        destination: `${currentDir}\\${config.BuildDir}\\${modName}-${version}.zip`,
        cwd: currentDir
    }).catch(function(err)
    {
        console.error(chalk.red("[SPT Build System] A bestzip error has occurred: ", err.stack));
    }).then(function()
    {
        // remove the temp directories
        fs.rmSync(`${relativeZipPath}`, { force: true, recursive: true });
        fs.rmSync(`${currentDir}/${modName}`, { force: true, recursive: true });
        console.log(chalk.green(`[SPT Build System] Compressed mod package to: ${config.BuildDir}\\${modName}.zip`));
    });
}

if (config.StartServer === true && config.PathToRoot !== "")
{
    console.log(chalk.green(`[SPT Build System] Server starting in ${config.StartDelay} seconds`));
    setTimeout(() => 
    {
        try 
        {
            const command = "Aki.Server.Exe";
            const output = processHost.execSync(command, {
                cwd: config.PathToRoot,
                stdio: "inherit" // This allows the output to be displayed in the terminal
            });
            console.log("Command executed successfully:", output.toString());
        }
        catch (error) 
        {
            console.error("Error executing command:", error.message);
        }
    }, config.StartDelay * 1000);
}
else
{
    console.log(chalk.red("[SPT Build System] Error starting server: Is the server path configured?"));
}
