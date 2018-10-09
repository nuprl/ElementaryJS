import { stopifyArray } from './runtime'

export function hire(comp: any, cand: any) {
  return {company: comp, candidate: cand};
}

// Returns true if input candidate prefers company 1 to company 2
function prefers(company1: any, company2: any, candidate: any, candidates: any[]) {
  return candidates[candidate].indexOf(company1) < candidates[candidate].indexOf(company2);
}

// Get index of input company in hires array
function getCompanyIndex(company: any, hires: any[]) { 
  for (let i = 0; i < hires.length; ++i) {
    if (hires[i].company === company) {
      return i;
    }
  }
  // If we haven't found a company yet, return -1 
  return -1;
}

// Remove the first hire with the input company from the hires list
function unHire(company: any, hires: any[], hasHired: any[]) {
  hasHired[company] = false;
  hires.splice(getCompanyIndex(company, hires), 1);
}

// Get company that hired input candidate
function getCompany(candidateNum: any, hires: any) {
  for (let i = 0; i < hires.length; ++i) {
    if (hires[i].candidate === candidateNum) {
      return hires[i].company;
    }
  }

  // If we haven't found a candidate yet, return -1 to crash the program
  // console.log("getCompany: There is no company associated with input candidate");
  return -1;
}

export function wheat1(companies: any[], candidates: any[]) {
  // Gale-Shapley Algorithm
  const n = companies.length;
  let hires = [];
  // True in this array implies that there is a provisional hiring
  let hasHired = Array(n).fill(false);  // Company List
  let wasHired = Array(n).fill(false);  // Candidate List
  // The number of times each company has attempted to hire a candidate
  let proposalCounts = Array(n).fill(0);

  let nextCompany = hasHired.indexOf(false);
  while(nextCompany !== -1) {
    const preferredCandidate = companies[nextCompany][proposalCounts[nextCompany]];
    if (!wasHired[preferredCandidate]) {
      // Candidate was free
      wasHired[preferredCandidate] = true;
      hasHired[nextCompany] = true;
      hires.push(hire(nextCompany, preferredCandidate));
    } else {
      // Candidate has already been hired
      const competitor = getCompany(preferredCandidate, hires);
      if (prefers(nextCompany, competitor, preferredCandidate, candidates)) {
        unHire(competitor, hires, hasHired);
        hasHired[nextCompany] = true;
        hires.push(hire(nextCompany, preferredCandidate));
      }
    }
    ++proposalCounts[nextCompany];
    nextCompany = hasHired.indexOf(false);
  }

  return stopifyArray(hires);
}

export function chaff1(companies: any, candidates: any) {
  return companies.reduce(function(acc: any, x: any) {acc.hires.push(hire(acc.n, acc.n)); ++acc.n; return acc;}, {hires: stopifyArray([]), n: 0}).hires;
}


