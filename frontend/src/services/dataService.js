/**
 * Retail IQ - Data Access Service Layer
 * 
 * Provides an abstracted data access layer for all UI components.
 * Loads committed ML pipeline outputs (customers, segment profiles, metrics, model manifest).
 * Designed to easily switch to remote REST/GraphQL API endpoints in production.
 */

import customersData from '../data/customers.json';
import segmentProfilesData from '../data/segmentProfiles.json';
import segmentationMetricsData from '../data/segmentationMetrics.json';
import modelMetadataData from '../data/modelMetadata.json';

// In case an external backend is attached in future:
const _API_BASE_URL = import.meta.env.VITE_API_URL || null;

class DataService {
  /**
   * Executive high-level analytics overview for Dashboard
   */
  async getOverviewStats() {
    // If external API is configured, we could do:
    // if (API_BASE_URL) return fetch(`${API_BASE_URL}/overview`).then(r => r.json());

    const totalCustomers = customersData.length;
    const totalRevenue = segmentProfilesData.reduce((acc, curr) => acc + (curr.total_revenue || 0), 0);
    const avgCustomerValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
    
    // Total orders
    const totalOrders = customersData.reduce((acc, curr) => acc + (curr.frequency || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // High value loyal segment stats
    const loyalSegment = segmentProfilesData.find(s => s.segment_name === 'High-Value Loyal') || {};
    const dormantSegment = segmentProfilesData.find(s => s.segment_name === 'At-Risk Dormant') || {};
    const offerSegment = segmentProfilesData.find(s => s.segment_name === 'Offer-Sensitive') || {};
    const occasionalSegment = segmentProfilesData.find(s => s.segment_name === 'Occasional Buyer') || {};

    return {
      totalCustomers,
      totalRevenue,
      avgCustomerValue,
      totalOrders,
      avgOrderValue,
      segmentsSummary: segmentProfilesData,
      topSegment: loyalSegment,
      atRiskRevenue: dormantSegment.total_revenue || 0,
      atRiskCustomers: dormantSegment.customer_count || 0,
      offerRevenue: offerSegment.total_revenue || 0,
      offerCustomers: offerSegment.customer_count || 0,
      occasionalCustomers: occasionalSegment.customer_count || 0,
      modelManifest: {
        candidateSet: modelMetadataData.candidate_set || 'Candidate 1 (Classic RFM-P)',
        clusters: modelMetadataData.n_clusters || 4,
        features: modelMetadataData.feature_names || [],
        selectedSilhouette: 0.5814,
        stabilityAri: 1.0,
      },
    };
  }

  /**
   * Retrieve all 4 segment profiles with strategic playbooks
   */
  async getSegmentProfiles() {
    return segmentProfilesData;
  }

  /**
   * Retrieve single segment profile by name
   */
  async getSegmentByName(segmentName) {
    const profile = segmentProfilesData.find(s => s.segment_name === segmentName);
    if (!profile) return null;
    return profile;
  }

  /**
   * Retrieve all customer records without pagination (for charts/analysis)
   */
  async getAllCustomers() {
    return customersData;
  }

  /**
   * Query customers with filtering, searching, sorting, and pagination
   */
  async getCustomers({
    search = '',
    segment = 'All',
    spendRange = 'all',
    recencyRange = 'all',
    sortBy = 'customer_id',
    sortOrder = 'asc',
    page = 1,
    pageSize = 10,
  } = {}) {
    let result = [...customersData];

    // Filter by search term (customer ID, segment name, or recommendation)
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        c =>
          c.customer_id.toLowerCase().includes(q) ||
          c.segment_name.toLowerCase().includes(q) ||
          (c.primary_recommendation && c.primary_recommendation.toLowerCase().includes(q))
      );
    }

    // Filter by segment
    if (segment && segment !== 'All') {
      result = result.filter(c => c.segment_name === segment);
    }

    // Filter by spend tier
    if (spendRange !== 'all') {
      if (spendRange === 'high') {
        result = result.filter(c => c.monetary >= 30000);
      } else if (spendRange === 'medium') {
        result = result.filter(c => c.monetary >= 10000 && c.monetary < 30000);
      } else if (spendRange === 'low') {
        result = result.filter(c => c.monetary < 10000);
      }
    }

    // Filter by recency range
    if (recencyRange !== 'all') {
      if (recencyRange === 'active') {
        result = result.filter(c => c.recency_days <= 30);
      } else if (recencyRange === 'warm') {
        result = result.filter(c => c.recency_days > 30 && c.recency_days <= 60);
      } else if (recencyRange === 'cooling') {
        result = result.filter(c => c.recency_days > 60 && c.recency_days <= 90);
      } else if (recencyRange === 'dormant') {
        result = result.filter(c => c.recency_days > 90);
      }
    }

    // Sorting
    result.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      // Handle nulls
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      // String vs numeric comparison
      if (typeof valA === 'string') {
        return sortOrder === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });

    const total = result.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const validPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (validPage - 1) * pageSize;
    const paginatedCustomers = result.slice(startIndex, startIndex + pageSize);

    return {
      customers: paginatedCustomers,
      total,
      page: validPage,
      pageSize,
      totalPages,
    };
  }

  /**
   * Retrieve a single customer by ID, enriched with segment benchmark comparisons
   */
  async getCustomerById(customerId) {
    const customer = customersData.find(c => c.customer_id === customerId);
    if (!customer) return null;

    const segmentProfile = segmentProfilesData.find(s => s.segment_name === customer.segment_name);

    // Compute cohort benchmarks
    const cohortAvgMonetary = customersData.reduce((acc, c) => acc + c.monetary, 0) / customersData.length;
    const cohortAvgRecency = customersData.reduce((acc, c) => acc + c.recency_days, 0) / customersData.length;
    const cohortAvgFrequency = customersData.reduce((acc, c) => acc + c.frequency, 0) / customersData.length;
    const cohortAvgLoyalty = customersData.reduce((acc, c) => acc + c.loyalty_score, 0) / customersData.length;

    return {
      ...customer,
      segmentProfile,
      benchmarks: {
        cohort: {
          monetary: cohortAvgMonetary,
          recency: cohortAvgRecency,
          frequency: cohortAvgFrequency,
          loyalty: cohortAvgLoyalty,
        },
        segment: {
          monetary: segmentProfile?.mean_monetary,
          recency: segmentProfile?.mean_recency,
          frequency: segmentProfile?.mean_frequency,
          loyalty: segmentProfile?.mean_loyalty_score,
        },
      },
    };
  }

  /**
   * Retrieve clustering evaluation grid metrics (28 candidate configurations)
   */
  async getSegmentationMetrics() {
    return {
      grid: segmentationMetricsData,
      candidateSets: [
        'Candidate 1 (Classic RFM-P)',
        'Candidate 2 (Decoupled Cadence/Basket)',
        'Candidate 3 (Spend and Basket)',
        'Candidate 4 (Temporal Extended)',
      ],
      champion: {
        candidateSet: 'Candidate 1 (Classic RFM-P)',
        k: 4,
        features: 'recency_days, log_frequency, log_monetary, offer_dependency',
        silhouetteScore: 0.5814,
        daviesBouldin: 0.6503,
        calinskiHarabasz: 281.92,
        stabilityAri: 1.0,
      },
    };
  }

  /**
   * RFM distribution breakdowns & summary stats
   */
  async getRfmDistribution() {
    const recencyValues = customersData.map(c => c.recency_days);
    const frequencyValues = customersData.map(c => c.frequency);
    const monetaryValues = customersData.map(c => c.monetary);

    // Binned Recency
    const recencyBins = [
      { name: '0-15d (Active)', count: 0, customers: [] },
      { name: '16-30d (Recent)', count: 0, customers: [] },
      { name: '31-60d (Warm)', count: 0, customers: [] },
      { name: '61-90d (Cooling)', count: 0, customers: [] },
      { name: '91-120d (At Risk)', count: 0, customers: [] },
      { name: '>120d (Dormant)', count: 0, customers: [] },
    ];

    // Binned Frequency
    const frequencyBins = [
      { name: '1-5 orders', count: 0 },
      { name: '6-15 orders', count: 0 },
      { name: '16-25 orders', count: 0 },
      { name: '26-35 orders', count: 0 },
      { name: '36+ orders', count: 0 },
    ];

    // Binned Monetary Spend
    const monetaryBins = [
      { name: '< $5k', count: 0, revenue: 0 },
      { name: '$5k - $15k', count: 0, revenue: 0 },
      { name: '$15k - $30k', count: 0, revenue: 0 },
      { name: '$30k - $50k', count: 0, revenue: 0 },
      { name: '> $50k', count: 0, revenue: 0 },
    ];

    customersData.forEach(c => {
      // Recency
      if (c.recency_days <= 15) recencyBins[0].count++;
      else if (c.recency_days <= 30) recencyBins[1].count++;
      else if (c.recency_days <= 60) recencyBins[2].count++;
      else if (c.recency_days <= 90) recencyBins[3].count++;
      else if (c.recency_days <= 120) recencyBins[4].count++;
      else recencyBins[5].count++;

      // Frequency
      if (c.frequency <= 5) frequencyBins[0].count++;
      else if (c.frequency <= 15) frequencyBins[1].count++;
      else if (c.frequency <= 25) frequencyBins[2].count++;
      else if (c.frequency <= 35) frequencyBins[3].count++;
      else frequencyBins[4].count++;

      // Monetary
      if (c.monetary < 5000) {
        monetaryBins[0].count++;
        monetaryBins[0].revenue += c.monetary;
      } else if (c.monetary < 15000) {
        monetaryBins[1].count++;
        monetaryBins[1].revenue += c.monetary;
      } else if (c.monetary < 30000) {
        monetaryBins[2].count++;
        monetaryBins[2].revenue += c.monetary;
      } else if (c.monetary < 50000) {
        monetaryBins[3].count++;
        monetaryBins[3].revenue += c.monetary;
      } else {
        monetaryBins[4].count++;
        monetaryBins[4].revenue += c.monetary;
      }
    });

    return {
      recencyBins,
      frequencyBins,
      monetaryBins,
      stats: {
        recency: {
          min: Math.min(...recencyValues),
          max: Math.max(...recencyValues),
          avg: recencyValues.reduce((a, b) => a + b, 0) / recencyValues.length,
        },
        frequency: {
          min: Math.min(...frequencyValues),
          max: Math.max(...frequencyValues),
          avg: frequencyValues.reduce((a, b) => a + b, 0) / frequencyValues.length,
        },
        monetary: {
          min: Math.min(...monetaryValues),
          max: Math.max(...monetaryValues),
          avg: monetaryValues.reduce((a, b) => a + b, 0) / monetaryValues.length,
        },
      },
    };
  }

  /**
   * Helper to trigger CSV file download in browser
   */
  exportToCsv(data, filename = 'retail_iq_export.csv') {
    if (!data || !data.length) return;
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        headers
          .map(header => {
            const val = row[header];
            if (val === null || val === undefined) return '';
            const escaped = ('' + val).replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(',')
      ),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const dataService = new DataService();
export default dataService;
