const parse = require("node-html-parser").parse;
const fetch = require("node-fetch");
const { createClient, gql } = require("@urql/core");

const API_URL = "https://api.thegraph.com/subgraphs/name/artblocks/art-blocks";

// core contract addresses to include during initilization
const CORE_CONTRACTS = require("../ProjectConfig/coreContracts.json");

const client = createClient({
  url: API_URL,
  fetch: fetch,
  fetchOptions: () => ({
    headers: {
      "Content-Type": "application/json",
    },
  }),
});

const contractProjectsMinimal = gql`
  query getContractProjectsMinimal($id: ID!, $first: Int!, $skip: Int) {
    contract(id: $id) {
      projects(first: $first, skip: $skip, orderBy: projectId) {
        projectId
      }
    }
  }
`;

const contractProject = gql`
  query getContractProject($id: ID!, $projectId: Int!) {
    contract(id: $id) {
      projects(where: { projectId: $projectId }) {
        name
        invocations
        maxInvocations
        curationStatus
        contract {
          id
        }
      }
    }
  }
`;

const contractFactoryProjects = gql`
  query getContractFactoryProjects($id: ID!, $first: Int!, $skip: Int) {
    contract(id: $id) {
      projects(
        where: { curationStatus: "factory" }
        first: $first
        skip: $skip
        orderBy: projectId
      ) {
        projectId
        name
        invocations
        maxInvocations
        curationStatus
        contract {
          id
        }
      }
    }
  }
`;

/*
 * helper function to get project count of a single
 * art blocks contract (uses pagination)
 */
async function _getContractProjectCount(contractId) {
  // max returned projects in a single query
  const maxProjectsPerQuery = 1000;
  try {
    let totalProjects = 0;
    while (true) {
      const result = await client
        .query(contractProjectsMinimal, {
          id: contractId,
          first: maxProjectsPerQuery,
          skip: totalProjects,
        })
        .toPromise();
      const numResults = result.data.contract.projects.length;
      totalProjects += numResults;
      if (numResults !== maxProjectsPerQuery) {
        break;
      }
    }
    return totalProjects;
  } catch (err) {
    console.error(err);
    return undefined;
  }
}

/*
 * get count of all artblocks projects
 */
async function getArtBlocksProjectCount() {
  try {
    const contractsToGet = Object.values(CORE_CONTRACTS);
    const promises = contractsToGet.map(_getContractProjectCount);
    const numProjects = await Promise.all(promises);
    return numProjects.reduce((sum, _projects) => sum + _projects);
  } catch (err) {
    console.error(err);
  }
  return undefined;
}

/*
 * helper function to get project by project number on
 * an art blocks contract.
 * Returns null if project doesn't exist on this contract.
 * Returns undefined if error is encountered.
 */
async function _getContractProject(projectId, contractId) {
  try {
    const result = await client
      .query(contractProject, {
        id: contractId,
        projectId: projectId,
      })
      .toPromise();
    return result.data.contract.projects.length > 0
      ? result.data.contract.projects[0]
      : null;
  } catch (err) {
    console.error(err);
    return undefined;
  }
}

/*
 * This function takes a projectId and contractId and returns a corresponding
 * project. If the contractId is null it will default to the Art Blocks
 * contracts otherwise it will use the passed contractId when contacting the
 * subgraph.
 */
async function getContractProject(projectId, contractId) {
  return !contractId ? getArtBlocksProject(projectId) : _getContractProject(projectId, contractId)
}

/*
 * get data for a flagship artblocks project
 * Returns undefined if no project found (errors or DNE).
 * If project found, returns object with:
 *   - curationStatus
 *   - invocations
 *   - maxInvocations
 *   - name
 *   - projectId
 *   - contract
 *     - id: string Contract Address
 */
async function getArtBlocksProject(projectNumber) {
  try {
    const contractsToGet = Object.values(CORE_CONTRACTS);
    const promises = contractsToGet.map(
      _getContractProject.bind(null, projectNumber)
    );
    const project = await Promise.all(promises);
    // return the element that is not null and not undefined
    return project.find((el) => el !== null && el !== undefined);
  } catch (err) {
    console.error(err);
  }
  return undefined;
}

/*
 * helper function to get factory projects of a single
 * art blocks contract (uses pagination)
 */
async function _getContractFactoryProjects(contractId) {
  // max returned projects in a single query
  const maxProjectsPerQuery = 1000;
  try {
    const factoryProjects = [];
    while (true) {
      const result = await client
        .query(contractFactoryProjects, {
          id: contractId,
          first: maxProjectsPerQuery,
          skip: factoryProjects.length,
        })
        .toPromise();
      factoryProjects.push(...result.data.contract.projects);
      if (result.data.contract.projects.length !== maxProjectsPerQuery) {
        break;
      }
    }
    return factoryProjects;
  } catch (err) {
    console.error(err);
    return undefined;
  }
}

/*
 * get data for all flagship artblocks factory projects
 * Returns undefined if errors encountered while fetching.
 * If project found, returns array of project objects with:
 *   - invocations
 *   - maxInvocations
 *   - name
 *   - projectId
 *   - contract
 *     - id: string Contract Address
 */
async function getArtBlocksFactoryProjects() {
  try {
    const contractsToGet = Object.values(CORE_CONTRACTS);
    const promises = contractsToGet.map(_getContractFactoryProjects);
    const allArrays = await Promise.all(promises);
    return [].concat.apply([], allArrays);
  } catch (err) {
    console.error(err);
  }
  return undefined;
}

module.exports.getArtBlocksProject = getArtBlocksProject;
module.exports.getArtBlocksFactoryProjects = getArtBlocksFactoryProjects;
module.exports.getArtBlocksProjectCount = getArtBlocksProjectCount;
module.exports.getContractProject = getContractProject;
