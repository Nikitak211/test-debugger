const currentScriptPath = (function () {
  const scripts = document.getElementsByTagName("script");
  const currentScript = scripts[scripts.length - 1];
  const scriptSrc = currentScript.src;

  // Get the directory path by removing the file name from the script's src
  const directoryPath = scriptSrc.substring(0, scriptSrc.lastIndexOf("/"));

  return directoryPath;
})();

const dirname = `${currentScriptPath}/`;

function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
const config = {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    // Add any additional headers if necessary
    // For example, if you need to include authorization headers:
    // 'Authorization': 'Bearer YOUR_TOKEN'
  },
};
let currentOpenFile = "";

function jsonDiff(obj1, obj2, path = "") {
  let diff = {};

  // Check for properties in obj1 that are not in obj2
  for (const key in obj1) {
    const fullPath = path ? `${path}.${key}` : key;
    if (obj1.hasOwnProperty(key) && !obj2.hasOwnProperty(key)) {
      diff[fullPath] = obj1[key];
    }
  }

  // Check for properties in obj2 that are not in obj1
  for (const key in obj2) {
    const fullPath = path ? `${path}.${key}` : key;
    if (obj2.hasOwnProperty(key) && !obj1.hasOwnProperty(key)) {
      diff[fullPath] = obj2[key];
    }
  }

  // Check for properties with different values
  for (const key in obj1) {
    const fullPath = path ? `${path}.${key}` : key;
    if (Array.isArray(obj1[key]) && Array.isArray(obj2[key])) {
      if (JSON.stringify(obj1[key]) !== JSON.stringify(obj2[key])) {
        if (typeof obj1[key][0] === "object" && typeof obj2[key][0] === "object") {
          const diff1 = [];

          for (const index in obj1[key]) {
            const fullPath = path ? `${path}.${index}` : index;
            diff1.push({});

            for (const ky in obj1[key][index]) {
              const fullPath1 = path ? `+ ${fullPath}.${ky}` : `+ ${ky}`;
              const fullPath2 = path ? `+ ${fullPath}.${ky}` : `- ${ky}`;

              if (obj1[key][index][ky] !== obj2[key][index][ky]) {
                diff1[index][fullPath1] = obj2[key][index][ky];
                diff1[index][fullPath2] = obj1[key][index][ky];
              }
            }
          }
          if (Object.keys(diff1).length > 0) {
            const filteredArr = diff1.filter((obj) => Object.keys(obj).length !== 0);

            diff[`+ ${fullPath}`] = filteredArr;
          }
        }
      }
    } else if (obj1.hasOwnProperty(key) && obj2.hasOwnProperty(key)) {
      if (obj1[key] !== obj2[key]) {
        diff[`+ ${fullPath}`] = obj2[key];
        diff[`- ${fullPath}`] = obj1[key];
      }
    }
  }

  return diff;
}

document.addEventListener("DOMContentLoaded", function () {
  const fileExplorer = document.getElementById("fileExplorer");
  const editor = document.getElementById("editor");
  let comparisonMode = false;
  let toCompare = [];

  document.getElementById("compareJson").addEventListener("click", () => {
    document.querySelectorAll(".file").forEach((node) => {
      node.classList.remove("selected");
      editor.innerHTML = ""; // Clear the editor
    });
    comparisonMode = !comparisonMode;
    if (comparisonMode) {
      toCompare = [];
    }
  });

  function compareJSON(compare) {
    // Assuming you have selected two JSON files and stored their paths in variables
    const filePath1 = compare[0]; // Replace with actual path
    const filePath2 = compare[1]; // Replace with actual path
    if (!comparisonMode) return;

    const name1 = filePath1.split("\\");
    const fixedName1 = `loader/${name1[name1.length - 1]}`;
    const jsonDataScript1 = document.getElementById(fixedName1);
    const jsonData1 = JSON.parse(jsonDataScript1.textContent);

    const name2 = filePath2.split("\\");
    const fixedName2 = `loader/${name2[name2.length - 1]}`;
    const jsonDataScript2 = document.getElementById(fixedName2);
    const jsonData2 = JSON.parse(jsonDataScript2.textContent);
    // Compare the content of the two JSON files
    const diff = jsonDiff(jsonData1, jsonData2);

    // Display the comparison result
    editor.innerHTML = "<pre>" + JSON.stringify(diff, null, 2) + "</pre>";
  }

  function createFileTree(parentElement, directory, className) {
    const ul = document.createElement("ul");
    ul.classList.add(className);
    ul.id = className;
    if (directory.name === "files") {
      const h1 = document.createElement("h3");
      h1.textContent = capitalizeFirstLetter(directory.name);
      h1.classList.add("main");
      ul.appendChild(h1);
    }

    directory.children?.forEach((item) => {
      const capitalName = capitalizeFirstLetter(item.name);
      if (item.name !== "manifest.json") {
        const li = document.createElement("li");
        li.id = item.name;
        const span = document.createElement("span");
        span.textContent = capitalName;
        li.appendChild(span);

        if (item.type === "directory") {
          const children = createFileTree(li, item, "file-tree-sub");
          span.classList.add("folder");
          span.addEventListener("click", (clicked) => {
            const target = clicked.target;
            // Remove 'selected' class from all fo
            if (target.textContent === capitalName && target.className === "folder selected") {
              // Check if editor is open
              if (className === "file-tree") {
                document.querySelectorAll(`#${item.name} .folder.selected`).forEach((node) => {
                  node.classList.remove("selected");
                  document.querySelectorAll(`#${item.name} .file`).forEach((node) => {
                    node.classList.remove("selected");
                  });
                  document.querySelectorAll(`#${item.name}.open`).forEach((node) => {
                    node.classList.toggle("open"); // Toggle the 'open' class on click
                  });

                  if (currentOpenFile === target.textContent) {
                    editor.innerHTML = ""; // Clear the editor
                  }
                });
                return;
              } else {
                document.querySelectorAll(".folder").forEach((node) => {
                  if (node.textContent === capitalName) {
                    node.classList.remove("selected");
                  }
                });
              }
            } else {
              if (li.classList.toString() !== "open") span.classList.add("selected"); // Mark the clicked folder as selected
            }
            li.classList.toggle("open"); // Toggle the 'open' class on click
          });
          if (children) li.appendChild(children);
        } else if (item.type === "file") {
          span.classList.add("file");
          if (item.extension === "json") {
            span.addEventListener("click", () => {
              currentOpenFile = capitalizeFirstLetter(item.path.split(`${"\\"}`)[0]);

              if (comparisonMode) {
                toCompare.push(`files/${item.path}`);
                span.classList.add("selected"); // Mark the clicked file as selected

                if (toCompare.length == 2) {
                  compareJSON(toCompare);
                  comparisonMode = false;
                  return;
                }
                return;
              }

              const name = item.path.split("\\");
              const fixedName = `loader/${name[name.length - 1]}`;
              const jsonDataScript = document.getElementById(fixedName);
              const directory = JSON.parse(jsonDataScript.textContent);

              const elem = `<pre>${JSON.stringify(directory, null, 2)}</pre>`;
              if (editor.innerHTML === elem) {
                document.querySelectorAll(".file").forEach((node) => {
                  node.classList.remove("selected");
                });
                editor.innerHTML = ""; // Clear the editor
                return;
              }
              document.querySelectorAll(".file").forEach((node) => {
                node.classList.remove("selected");
              });
              span.classList.add("selected"); // Mark the clicked file as selected
              editor.innerHTML = elem;
            });
          }
        }

        ul.appendChild(li);
      }
    });

    parentElement.appendChild(ul);
    return ul;
  }

  document.getElementById("loadJsonButton").addEventListener("click", () => {
    location.reload();
  });
  const jsonDataScript = document.getElementById("loader/manifest.json");
  const directory = JSON.parse(jsonDataScript.textContent);

  createFileTree(fileExplorer, directory, "file-tree");
});
