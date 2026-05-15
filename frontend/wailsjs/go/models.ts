export namespace main {
	
	export class List {
	    id: number;
	    title: string;
	    createdAt: string;
	    totalTodos: number;
	    incompleteTodos: number;
	
	    static createFrom(source: any = {}) {
	        return new List(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.createdAt = source["createdAt"];
	        this.totalTodos = source["totalTodos"];
	        this.incompleteTodos = source["incompleteTodos"];
	    }
	}
	export class Todo {
	    id: number;
	    listId: number;
	    title: string;
	    completed: boolean;
	    createdAt: string;
	    completedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Todo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.listId = source["listId"];
	        this.title = source["title"];
	        this.completed = source["completed"];
	        this.createdAt = source["createdAt"];
	        this.completedAt = source["completedAt"];
	    }
	}

}

