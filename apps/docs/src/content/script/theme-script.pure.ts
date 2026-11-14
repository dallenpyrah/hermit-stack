const themeStorageKey = "hermit-stack-theme";

const themeScript = [
  "(function(){try{",
  `var t=window.localStorage.getItem('${themeStorageKey}');`,
  "if(t==='light'||t==='dark'||t==='system')document.documentElement.classList.add(t)",
  "}catch(e){}})()",
].join("");

export { themeStorageKey, themeScript };
