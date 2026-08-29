import { heightAt, ISLAND_R } from '../../src/world/terrain.js';
import { escapable, wayOut, routeFrom, headingTo, routeStats, warmRoutes } from '../../src/world/paths.js';
warmRoutes();
console.log('stats', JSON.stringify(routeStats()));
