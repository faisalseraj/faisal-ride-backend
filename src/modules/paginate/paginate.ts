/* eslint-disable no-param-reassign */
import { Document, Schema } from 'mongoose';

export interface QueryResult {
  results: Document[];
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
}

export interface IOptions {
  sortBy?: string;
  projectBy?: string;
  populate?: string;
  limit?: number;
  page?: number;
  search?: string;
  timeImplementation?: string;
  orFilterAdvance?: any;
}

const paginate = <T extends Document>(schema: Schema<T>): void => {
  /**
   * @typedef {Object} QueryResult
   * @property {Document[]} results - Results found
   * @property {number} page - Current page
   * @property {number} limit - Maximum number of results per page
   * @property {number} totalPages - Total number of pages
   * @property {number} totalResults - Total number of documents
   */
  /**
   * Query for documents with pagination
   * @param {Object} [filter] - Mongo filter
   * @param {Object} [options] - Query options
   * @param {string} [options.sortBy] - Sorting criteria using the format: sortField:(desc|asc). Multiple sorting criteria should be separated by commas (,)
   * @param {string} [options.populate] - Populate data fields. Hierarchy of fields should be separated by (.). Multiple populating criteria should be separated by commas (,)
   * @param {number} [options.limit] - Maximum number of results per page (default = 10)
   * @param {number} [options.page] - Current page (default = 1)
   * @param {string} [options.projectBy] - Fields to hide or include (default = '')
   * @param {string} [options.search] - implementing search. format is {string to search} # fields separated with commas to implement the search on,
   * @param {string} [options.timeImplementation] - implementing search. format is {string to search} # fields separated with commas to implement the search on,
   * @returns {Promise<QueryResult>}
   */
  schema.static(
    'paginate',
    async function (filter: Record<string, any>, options: IOptions, orFilter?: any): Promise<QueryResult> {
      let sort: string = '';
      let orFilters: any = {};
      let orFiltersAdvance: any = {};
      orFiltersAdvance;
      if (orFilter) {
        const f = JSON.parse(orFilter);
        if (f?.length) {
          orFilters = { $or: f };
        }
      }

      if (options?.orFilterAdvance && options?.orFilterAdvance?.length > 0) {
        orFiltersAdvance = {
          $or: [...options?.orFilterAdvance, filter],
        };
      } else {
        orFiltersAdvance = filter;
      }

      if (options.sortBy) {
        const sortingCriteria: any = [];
        options.sortBy.split(',').forEach((sortOption: string) => {
          const [key, order] = sortOption.split(':');
          sortingCriteria.push((order === 'desc' ? '-' : '') + key);
        });
        sort = sortingCriteria.join(' ');
      } else {
        sort = '-createdAt';
      }

      let search: any = {};

      if (options.search) {
        const searching = options.search.split('#');
        let orQuery: any[] = [];
        if (searching && searching.length > 0 && searching?.[0] && searching?.[1]) {
          // const sea = decodeURI(searching?.[0]);
          // console.log(sea, 'search content is here');
          // const searchRegex = new RegExp(sea?.replace('+', ''), 'i'); // 'i' for case-insensitive search
          // orQuery = searching?.[1].split(',').map((key) => ({
          //   [key]: { $regex: searchRegex },
          // }));
          // search = {
          //   $or: orQuery,
          // };
          const sea = decodeURI(searching?.[0] || '');

          const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const searchRegex = new RegExp(escapeRegex(sea), 'i'); // Escaped +, etc.

          orQuery = searching?.[1]?.split(',')?.map((key) => ({
            [key]: { $regex: searchRegex },
          }));

          search = {
            $or: orQuery,
          };
        }
      }

      let timeQuery = null;

      if (filter) {
        let { from, to } = filter;
        delete filter['from'];
        delete filter['to'];

        if (from && to) {
          from = `${from.split('T')[0]}T00:00:00Z`;
          to = `${to.split('T')[0]}T23:59:59Z`;

          timeQuery = {
            $gte: from,
            $lte: to,
          };
        } else if (from) {
          from = `${from.split('T')[0]}T00:00:00Z`;
          to = `${from.split('T')[0]}T23:59:59Z`;
          timeQuery = {
            $gte: from,
            $lte: to,
          };
        }
      }

      // timeQuery = {
      //   $gte: new Date('2023-06-01').toISOString(),
      //   $lte: new Date('2023-07-15').toISOString(),
      // };
      orFilters;
      let project: string = '';
      if (options.projectBy) {
        const projectionCriteria: string[] = [];
        options.projectBy.split(',').forEach((projectOption) => {
          const [key, include] = projectOption.split(':');
          projectionCriteria.push((include === 'hide' ? '-' : '') + key);
        });
        project = projectionCriteria.join(' ');
      } else {
        // project = ' -updatedAt';
      }

      const limit =
        options.limit && parseInt(options.limit.toString(), 10) > 0 ? parseInt(options.limit.toString(), 10) : 10;
      const page = options.page && parseInt(options.page.toString(), 10) > 0 ? parseInt(options.page.toString(), 10) : 1;
      const skip = (page - 1) * limit;
      const timeFilter = timeQuery && options.timeImplementation ? { [options.timeImplementation]: timeQuery } : {};

      const countPromise = this.countDocuments({
        // ...filter,
        ...search,
        ...timeFilter,
        // ...orFilters,
        ...orFiltersAdvance,
      }).exec();
      let docsPromise = search
        ? this.find({
            ...timeFilter,
            // ...filter,
            ...search,
            // ...orFilters,
            ...orFiltersAdvance,
          })
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .select(project)
        : this.find({
            ...timeFilter,
            // ...filter,
            // ...orFilters,
            ...orFiltersAdvance,
          } as any)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .select(project);

      if (options.populate) {
        options.populate.split(',').forEach((populateOption: any) => {
          if (populateOption.includes('~~')) {
            const removingFieldsFromOptions = populateOption.split('~~');
            docsPromise = docsPromise.populate(
              removingFieldsFromOptions[0]
                .split('.')
                .reverse()
                .reduce((a: string, b: string) => ({ path: b, populate: a })),
              removingFieldsFromOptions[1]
            );
          } else {
            docsPromise = docsPromise.populate(
              populateOption
                .split('.')
                .reverse()
                .reduce((a: string, b: string) => ({ path: b, populate: a }))
            );
          }
        });
      }

      docsPromise = docsPromise.exec();
      return Promise.all([countPromise, docsPromise]).then((values) => {
        const [totalResults, results] = values;
        const totalPages = Math.ceil(totalResults / limit);
        const result = {
          results,
          page,
          limit,
          totalPages,
          totalResults,
        };
        return Promise.resolve(result);
      });
    }
  );
};

export default paginate;
