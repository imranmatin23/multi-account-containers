/**
 * Once a user clicks the multi-account containers button in the browser toolbar, 
 * they will see an option that says "Always Open this Site in...". When they
 * click that this, method runs to populate the next menu with all of the containers
 * the user can open the url in.
 * 
 * The function just gets all containers, and for each container create an 
 * HTML element for the user to see.
 */
async function init() {
  const fragment = document.createDocumentFragment();

  const identities = await browser.contextualIdentities.query({});

  identities.forEach(identity => {
    const tr = document.createElement("tr");
    tr.classList.add("menu-item", "hover-highlight");
    const td = document.createElement("td");

    td.innerHTML = Utils.escaped`          
        <div class="menu-icon">
          <div class="usercontext-icon"
            data-identity-icon="${identity.icon}"
            data-identity-color="${identity.color}">
          </div>
        </div>
        <span class="menu-text">${identity.name}</span>`;
    
    tr.appendChild(td);
    fragment.appendChild(tr);

    Utils.addEnterHandler(tr, async () => {
      Utils.alwaysOpenInContainer(identity);
      window.close();
    });
  });

  const list = document.querySelector("#picker-identities-list");

  list.innerHTML = "";
  list.appendChild(fragment);
}

// Runs whenever you click the multi-account button in the tool bar to get the
// most update to date list of all containers.
init();
