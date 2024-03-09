import fs from "fs";
import path from "path";

import isEqual from "lodash/isEqual";

import opn from "opn";

const { exec } = require("child_process");
const errorLogStore = [];
const infoLogStore = [];

const fsp = fs.promises;
const rootDir = `${__dirname}/files`;
let once = false;
function openHTMLFile(filePath) {
  once = true;
  const command = `tasklist /fi "imagename eq chrome.exe" /nh /fo csv`;

  exec(command, (err, stdout) => {
    console.log("_____ stdout _____", stdout);
    if (err) {
      console.error(`Error checking if Chrome is running: ${err}`);
      return;
    }

    const isChromeRunning = stdout.includes("chrome.exe");

    if (!isChromeRunning) {
      // If Chrome is not running, open the HTML file directly
      opn(filePath);
    } else {
      // If Chrome is already running, do nothing
      console.log("The HTML file is already open in the browser.");
    }
  });
}

function folderToJson(folderPath) {
  const directory = {
    name: path.basename(folderPath),
    type: "directory",
    children: [],
  };

  const files = fs.readdirSync(folderPath);

  files?.forEach((file) => {
    const filePath = path.join(folderPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      directory.children.push(folderToJson(filePath));
    } else {
      directory.children.push({
        name: file,
        type: "file",
        extension: path.extname(file).slice(1), // Extract file extension without the dot
        path: path.relative(rootDir, filePath),
      });
    }
  });

  return directory;
}
// Function to write file asynchronously
async function writeFile(filePath, data) {
  try {
    await fsp.writeFile(filePath, data);
  } catch (error) {
    console.error(`Error writing file ${filePath}: ${error}`);
    throw error;
  }
}

function generateVersionedFilename(id, newContent) {
  let version = "0.0.1";
  let count = 0;
  const dirToFolder = `${rootDir}/${id}`;
  let fileName = `${id}-${version}`;
  let logs = {
    timestamp: new Date(),
    log: {},
  };
  while (fs.existsSync(`${dirToFolder}/${id}-${version}.json`)) {
    const existingContent = fs.readFileSync(`${rootDir}/${id}/${id}-${version}.json`, "utf8");
    if (isEqual(JSON.parse(existingContent), JSON.parse(newContent))) {
      logs = {
        timestamp: new Date(),
        log: {
          existingContent: JSON.parse(existingContent),
          message: "dataWriter - data is identical, stopped writing.",
        },
      };

      return { fileName, changed: false, logs };
    }

    count++;
    version = `0.0.${count}`;
    fileName = `${id}-${version}`;
  }

  return { fileName, changed: true };
}

export const dataWriter = async (result, id, openExplorerActive) => {
  const dirToFolder = `${rootDir}/${id}`;
  const dirToFolderLogs = `${rootDir}/${id}/logs`;
  const dirToLogs = `${rootDir}/logs`;
  const resultData = JSON.stringify(result);

  const { fileName, changed, logs } = generateVersionedFilename(id, resultData);

  const filePath = `${dirToFolder}/${fileName}.json`;
  const filePathLogs = `${dirToFolderLogs}/${fileName}.logs.json`;

  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir);
    fs.mkdirSync(dirToFolder);
    fs.mkdirSync(dirToFolderLogs);
    fs.mkdirSync(dirToLogs);
  } else {
    if (!fs.existsSync(dirToFolder)) {
      fs.mkdirSync(dirToFolder);
      fs.mkdirSync(dirToFolderLogs);
      fs.mkdirSync(dirToLogs);
    }
  }

  const logger = (message, level = "error") => {
    const logStore = level === "error" ? errorLogStore : infoLogStore;

    if (fs.existsSync(dirToLogs) && fs.existsSync(`${dirToLogs}/${level}.json`)) {
      logStore.push({
        timestamp: new Date(),
        message,
        level,
      });
    }

    writeFile(`${dirToLogs}/${level}.json`, JSON.stringify(logStore)).catch(() => {});
  };
  function findJsonFiles(directoryPath = rootDir) {
    // Read the contents of the directory
    const files = fs.readdirSync(directoryPath);
    const scripts = files.map((file) => {
      // Construct the full path of the item
      const fullPath = path.join(directoryPath, file);

      if (file.includes(".json")) {
        const jso = fs.readFileSync(fullPath, "utf8");
        return `<script id="loader/${file}" type="application/json">${jso}</script>`;
      } else {
        logger(`isDir: ${fullPath}`, "info");
        return findJsonFiles(fullPath).join(" ");
      }
    });
    return scripts;
  }

  const callWriteFiles = () => {
    fs.unlink(`${rootDir}/manifest.json`, async (err) => {
      if (err) {
        console.error("Error deleting file:", err);
      }

      await writeFile(`${rootDir}/manifest.json`, JSON.stringify(folderToJson(rootDir))).finally(() => {
        const stringWithSpaces = findJsonFiles().join(" ");
        const htmlContent = `
        <!-- index.html -->
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>File Explorer</title>
            <link rel="stylesheet" href="styles.css" />
          </head>
          <body>
            <button id="compareJson">Compare JSON</button>
            <div class="container">
              <div id="fileExplorer"></div>
              <div id="editor"></div>
            </div>
            ${stringWithSpaces}
            <script src="script.js"></script>
            <button id="loadJsonButton">Load JSON</button>
          </body>
        </html>
        `;

        fs.unlink(`${__dirname}/fileWriter.html`, async (err) => {
          if (err) {
            console.error("Error deleting file:", err);
          }

          // Write the generated HTML content to a new HTML file
          await writeFile(`${__dirname}/fileWriter.html`, htmlContent);
        });

        if (openExplorerActive && !once) openHTMLFile(`${__dirname}/fileWriter.html`);
      });
    });
  };

  if (logs) {
    if (fs.existsSync(`${dirToFolderLogs}/${fileName}.logs.json`)) {
      const existingLog = fs.readFileSync(`${dirToFolderLogs}/${fileName}.logs.json`, "utf8");
      const parsed = JSON.parse(existingLog);
      parsed.push(logs);
      writeFile(filePathLogs, JSON.stringify(parsed)).finally(() => {
        callWriteFiles();
      });
    } else {
      writeFile(filePathLogs, JSON.stringify([logs])).finally(() => {
        callWriteFiles();
      });
    }
  }

  if (!changed) {
    return;
  }

  writeFile(filePath, resultData).finally(() => {
    callWriteFiles();
  });
};

// const { dataWriter } = require("the path to the file");
// dataWriter(result, require, id);
