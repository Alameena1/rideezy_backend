import { injectable } from "inversify";
import { Model, Document, FilterQuery, UpdateQuery, ClientSession } from "mongoose";

// Custom type to support arrayFilters without UpdateOptions
interface MongoUpdateOptions {
  session?: ClientSession;
  arrayFilters?: { [key: string]: any }[];
  new?: boolean;
  runValidators?: boolean;
  [key: string]: any; // Allow other Mongoose options
}

@injectable()
export abstract class BaseRepository<T extends Document> {
  protected model: Model<T>;

  constructor(model: Model<T>) {
    this.model = model;
  }

  async startSession(): Promise<ClientSession> {
    return this.model.startSession();
  }

  async create(data: Partial<T>, options?: { session: ClientSession }): Promise<T> {
    try {
      const document = await this.model.create([data], { session: options?.session ?? null });
      return document[0] as T;
    } catch (error) {
      throw new Error(`Failed to create document: ${(error as Error).message}`);
    }
  }

  async findById(id: string, options?: { session: ClientSession }): Promise<T | null> {
    try {
      const document = await this.model
        .findById(id)
        .select("-password")
        .session(options?.session ?? null)
        .lean()
        .exec();
      return document as T | null;
    } catch (error) {
      throw new Error(`Failed to find document by ID: ${(error as Error).message}`);
    }
  }

  async find(query: FilterQuery<T>, options?: { session: ClientSession }): Promise<T[]> {
    try {
      const documents = await this.model
        .find(query)
        .select("-password")
        .session(options?.session ?? null)
        .lean()
        .exec();
      return documents as T[];
    } catch (error) {
      throw new Error(`Failed to find documents: ${(error as Error).message}`);
    }
  }

  async findOne(query: FilterQuery<T>, options?: { session: ClientSession }): Promise<T | null> {
    try {
      const document = await this.model
        .findOne(query)
        .select("-password")
        .session(options?.session ?? null)
        .lean()
        .exec();
      return document as T | null;
    } catch (error) {
      throw new Error(`Failed to find document: ${(error as Error).message}`);
    }
  }

  async updateById(id: string, data: Partial<T>, options?: { session: ClientSession }): Promise<T | null> {
    try {
      const document = await this.model
        .findByIdAndUpdate(id, data, { new: true, runValidators: true, session: options?.session ?? null })
        .lean()
        .exec();
      return document as T | null;
    } catch (error) {
      throw new Error(`Failed to update document: ${(error as Error).message}`);
    }
  }

  async updateOne(query: FilterQuery<T>, update: UpdateQuery<T>, options?: MongoUpdateOptions): Promise<T | null> {
    try {
      console.log('[BaseRepository] updateOne:', { query, update, options });
      const result = await this.model.updateOne(query, update, { ...options, runValidators: true }).exec();
      console.log('[BaseRepository] update result:', result);
      const document = await this.model.findOne(query).session(options?.session ?? null).lean().exec();
      return document as T | null;
    } catch (error) {
      throw new Error(`Failed to update document: ${(error as Error).message}`);
    }
  }

  async deleteById(id: string, options?: { session: ClientSession }): Promise<boolean> {
    try {
      const result = await this.model.deleteOne({ _id: id }, { session: options?.session });
      return result.deletedCount === 1;
    } catch (error) {
      throw new Error(`Failed to delete document: ${(error as Error).message}`);
    }
  }
}